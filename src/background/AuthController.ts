import { action, computed } from 'mobx';
import passworder from 'browser-passworder';
import { Bucket, getBucket, storage } from '@extend-chrome/storage';
import * as nacl from 'tweetnacl';
import {
  encodeBase16,
  decodeBase16,
  Keys,
  CLPublicKey,
  encodeBase64,
  decodeBase64
} from 'casper-js-sdk';
import { AppState } from '../lib/MemStore';
import { KeyPairWithAlias } from '../@types/models';
import { saveAs } from 'file-saver';
import { updateStatusEvent } from './utils';
// import KeyEncoder from 'key-encoder';

interface TimerStore {
  lockedOutTimestampMillis: number;
}

export interface SerializedKeyPairWithAlias {
  name: string;
  keyPair: {
    publicKey: string; // hex encoded
    secretKey: string; // hex encoded
  };
}

interface PersistentVaultData {
  userAccounts: SerializedKeyPairWithAlias[];
  selectedUserAccount: SerializedKeyPairWithAlias | null;
}

function saveToFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  saveAs(blob, filename);
}

class AuthController {
  // we store the salted password hash instead of original password
  private passwordHash: string | null = null;
  private passwordSalt: Uint8Array | null = null;

  // we will use the passwordHash above to encrypt the value object
  // and then using this key to store it in local storage along with
  // the plain text salt for the password.
  private encryptedVaultKey = 'encryptedVault';
  private saltKey = 'passwordSalt';

  private timerStore: Bucket<TimerStore>;
  private timer: any;

  constructor(private appState: AppState) {
    if (this.getStoredValueWithKey(this.encryptedVaultKey) !== null) {
      this.appState.hasCreatedVault = true;
    }
    this.timerStore = getBucket<TimerStore>('timerStore');
    this.timerStore
      .get('lockedOutTimestampMillis')
      .then(({ lockedOutTimestampMillis }) => {
        if (!lockedOutTimestampMillis) return;
        let currentTimeMillis = new Date().getTime();
        let timeElapsedMins =
          (currentTimeMillis - lockedOutTimestampMillis) / 1000 / 60;
        if (timeElapsedMins < this.appState.timerDurationMins) {
          let remainingMins = this.appState.timerDurationMins - timeElapsedMins;
          this.appState.remainingMins = remainingMins;
          this.appState.unlockAttempts = 0;
          this.startLockoutTimer(remainingMins, false);
        }
      });
    this.initStore();

    this.timer = null;

    chrome.runtime.onConnect.addListener(port => {
      if (this.timer) {
        clearTimeout(this.timer);
      }
      port.onDisconnect.addListener(() => {
        this.timer = setTimeout(() => {
          this.lock();
        }, 1000 * 60);
      });
    });
  }

  async initStore() {
    const passwordSalt = await this.getStoredValueWithKey(this.saltKey);
    if (passwordSalt) {
      this.passwordSalt = passwordSalt;
    }
  }

  @action.bound
  async createNewVault(password: string): Promise<void> {
    const vault = await this.getStoredValueWithKey(this.encryptedVaultKey);
    if (vault) {
      throw new Error('There is a vault already');
    }
    let [salt, saltedPassword] = this.saltPassword(password);
    let hash = this.hash(saltedPassword);
    this.passwordSalt = salt;
    this.passwordHash = hash;
    await this.clearAccount();
    await this.persistVault();
    this.appState.hasCreatedVault = true;
    this.appState.isUnlocked = true;
  }

  @action
  switchToAccount(accountName: string) {
    let i = this.appState.userAccounts.findIndex(a => a.alias === accountName);
    if (i === -1) {
      throw new Error(
        "Couldn't switch to this account because it doesn't exist"
      );
    }
    this.appState.selectedUserAccount = this.appState.userAccounts[i];
    updateStatusEvent(this.appState, 'activeKeyChanged');
  }

  getSelectUserAccount(): KeyPairWithAlias {
    if (!this.appState.selectedUserAccount) {
      throw new Error('There is no active key');
    }
    return this.appState.selectedUserAccount;
  }

  getActivePublicKeyHex(): string {
    if (!this.appState.selectedUserAccount) {
      throw new Error('There is no active key');
    }
    let account = this.appState.selectedUserAccount;
    return account.KeyPair.publicKey.toHex();
  }

  getActiveAccountHash(): string {
    if (!this.appState.selectedUserAccount) {
      throw new Error('There is no active key');
    }
    let account = this.appState.selectedUserAccount;
    return encodeBase16(account.KeyPair.publicKey.toAccountHash());
  }

  @action
  async resetVault() {
    await this.clearAccount();
    this.appState.selectedUserAccount = null;
    this.appState.unsignedDeploys.clear();
    this.appState.hasCreatedVault = false;
    storage.local.remove(this.encryptedVaultKey);
  }

  @action
  async importUserAccount(
    name: string,
    secretKeyBase64: string,
    algorithm: string
  ) {
    if (!this.appState.isUnlocked) {
      throw new Error('Unlock it before adding new account');
    }

    let duplicateAccount = this.appState.userAccounts.find(account => {
      return (
        account.alias === name ||
        encodeBase64(account.KeyPair.privateKey) === secretKeyBase64
      );
    });

    if (duplicateAccount) {
      throw new Error(
        `A account with same ${
          duplicateAccount.alias === name ? 'name' : 'secret key'
        } already exists`
      );
    }
    const secretKeyBytes = decodeBase64(secretKeyBase64);
    let secretKey, publicKey, keyPair: Keys.Ed25519 | Keys.Secp256K1;
    switch (algorithm) {
      case 'ed25519': {
        secretKey = Keys.Ed25519.parsePrivateKey(secretKeyBytes);
        publicKey = Keys.Ed25519.privateToPublicKey(secretKeyBytes);
        keyPair = Keys.Ed25519.parseKeyPair(publicKey, secretKey);
        break;
      }
      case 'secp256k1': {
        secretKey = Keys.Secp256K1.parsePrivateKey(secretKeyBytes, 'raw');
        publicKey = Keys.Secp256K1.privateToPublicKey(secretKeyBytes);
        keyPair = Keys.Secp256K1.parseKeyPair(publicKey, secretKey, 'raw');
        break;
      }
      default: {
        throw new Error('Could not parse secret key as: ed25519 or secp256k1');
      }
    }

    this.appState.userAccounts.push({
      alias: name,
      KeyPair: keyPair
    });
    this.appState.selectedUserAccount =
      this.appState.userAccounts[this.appState.userAccounts.length - 1];
    this.persistVault();
  }

  @action
  async removeUserAccount(name: string) {
    if (!this.appState.isUnlocked) {
      throw new Error('Unlock it before adding new account');
    }

    let account = this.appState.userAccounts.find(account => {
      return account.alias === name;
    });

    if (!account) {
      throw new Error(`The account does't exists`);
    }

    this.appState.userAccounts.remove(account);

    if (this.appState.selectedUserAccount?.alias === account.alias) {
      this.appState.selectedUserAccount =
        this.appState.userAccounts.length > 0
          ? this.appState.userAccounts[0]
          : null;
    }
    this.persistVault();
  }

  getAccountFromAlias(alias: string) {
    if (!alias) throw new Error('Cannot find account for invalid alias');
    let account = this.appState.userAccounts.find(storedAccount => {
      return storedAccount.alias === alias;
    });
    return account?.KeyPair;
  }

  async downloadAccountKeys(accountAlias: string) {
    if (!this.appState.isUnlocked) {
      throw new Error('Unlock Signer before downloading keys.');
    }
    let accountKeys = this.getAccountFromAlias(accountAlias);
    if (accountKeys) {
      saveToFile(
        accountKeys.exportPrivateKeyInPem(),
        `${accountAlias}_secret_key.pem`
      );
      saveToFile(
        accountKeys.exportPublicKeyInPem(),
        `${accountAlias}_public_key.pem`
      );
      saveToFile(
        accountKeys.publicKey.toHex(),
        `${accountAlias}_public_key_hex.txt`
      );
    }
  }

  /**
   * Reorder account
   * In UI page, a user could drag the account whose index is startIndex, and drop to
   * a new position endIndex.
   *
   * For example, if we have a list, [a,b,c,d,e], now startIndex is 2, endIndex is 4.
   * After this operation, the result is [a,b,d,e,c]
   *
   * @param startIndex
   * @param endIndex
   */
  @action
  async reorderAccount(startIndex: number, endIndex: number) {
    if (!this.appState.isUnlocked) {
      throw new Error('Unlock it before reorder account');
    }

    const len = this.appState.userAccounts.length;
    if (
      startIndex < 0 ||
      endIndex < 0 ||
      startIndex >= len ||
      endIndex >= len
    ) {
      throw new Error('Invalid index number');
    }
    if (startIndex === endIndex) {
      return;
    }

    const removed = this.appState.userAccounts.spliceWithArray(startIndex, 1);
    this.appState.userAccounts.spliceWithArray(endIndex, 0, removed);

    this.persistVault();
  }

  @action
  async renameUserAccount(oldName: string, newName: string) {
    if (!this.appState.isUnlocked) {
      throw new Error('Unlock it before rename account');
    }

    if (!newName) {
      throw new Error('Invalid new name');
    }

    const account = this.appState.userAccounts.find(
      account => account.alias === oldName
    );
    if (!account) {
      throw new Error('Invalid old name');
    }

    const accountWithNewName = this.appState.userAccounts.find(
      account => account.alias === newName
    );

    if (accountWithNewName) {
      throw new Error('There is another account with the same name');
    }

    account.alias = newName;

    this.persistVault();
  }

  /**
   * Serialize and Deserialize is needed for ByteArray(or Uint8Array),
   * since JSON.parse(JSON.stringify(ByteArray)) !== ByteArray
   */

  /**
   * Serialize the byte arrays into encoded strings.
   * @param KeyPairWithAlias
   * @returns KeyPairWithAlias with encoded values.
   */
  private serializeKeyPairWithAlias(
    KeyPairWithAlias: KeyPairWithAlias
  ): SerializedKeyPairWithAlias {
    return {
      name: KeyPairWithAlias.alias,
      keyPair: {
        publicKey: KeyPairWithAlias.KeyPair.publicKey.toHex(),
        secretKey: encodeBase64(KeyPairWithAlias.KeyPair.privateKey)
      }
    };
  }

  private deserializeKeyPairWithAlias(
    serializedKeyPairWithAlias: SerializedKeyPairWithAlias
  ): KeyPairWithAlias {
    const serializedPublicKey = serializedKeyPairWithAlias.keyPair.publicKey;
    let deserializedPublicKeyBytes, deserializedPublicKey, deserializedKeyPair;

    switch (serializedPublicKey.substring(0, 2)) {
      case '01':
        deserializedPublicKeyBytes = Keys.Ed25519.parsePublicKey(
          decodeBase16(serializedPublicKey.substring(2))
        );
        deserializedPublicKey = CLPublicKey.fromEd25519(
          deserializedPublicKeyBytes
        );
        deserializedKeyPair = Keys.Ed25519.parseKeyPair(
          deserializedPublicKey.value(),
          decodeBase64(serializedKeyPairWithAlias.keyPair.secretKey)
        );
        break;
      case '02':
        deserializedPublicKeyBytes = Keys.Secp256K1.parsePublicKey(
          decodeBase16(serializedPublicKey.substring(2)),
          'raw'
        );
        deserializedPublicKey = CLPublicKey.fromSecp256K1(
          deserializedPublicKeyBytes
        );
        deserializedKeyPair = Keys.Secp256K1.parseKeyPair(
          deserializedPublicKey.value(),
          decodeBase64(serializedKeyPairWithAlias.keyPair.secretKey),
          'raw'
        );
        break;
      default:
        throw new Error('Failed to deserialize public key!');
    }

    return {
      alias: serializedKeyPairWithAlias.name,
      KeyPair: deserializedKeyPair
    };
  }

  /**
   * Encrypt user accounts using salted password hash.
   * Save the encryptedVault string to the store.
   * Save the plain text passwordSalt to the store.
   */
  private async persistVault() {
    const encryptedVault = await passworder.encrypt(this.passwordHash!, {
      userAccounts: this.appState.userAccounts.map(
        this.serializeKeyPairWithAlias
      ),
      selectedUserAccount: this.appState.selectedUserAccount
        ? this.serializeKeyPairWithAlias(this.appState.selectedUserAccount)
        : null
    });

    await this.saveKeyValuetoStore(this.encryptedVaultKey, encryptedVault);
    await this.saveKeyValuetoStore(this.saltKey, this.passwordSalt!);
    updateStatusEvent(this.appState, 'activeKeyChanged');
  }

  /**
   * Saves a given value under a given key in the store.
   * @param key Key to save value under in store.
   * @param value Value to save under Key in store.
   */
  private async saveKeyValuetoStore(key: string, value: any) {
    if (!value) return;
    return storage.local.set({ [key]: JSON.stringify(value) });
  }

  /**
   * Get a stored value by key. If no key exists then return null.
   * @param key Key under which value is stored.
   * @returns Stored value by given key.
   */
  private async getStoredValueWithKey(key: string) {
    let value = await storage.local.get(key);
    if (value[key]) {
      return JSON.parse(value[key]);
    }
    return null;
  }

  private async restoreVault(
    password: string
  ): Promise<[PersistentVaultData, string]> {
    let encryptedVault = await this.getStoredValueWithKey(
      this.encryptedVaultKey
    );
    if (!encryptedVault) {
      throw new Error('There is no vault');
    }
    let storedSalt = await this.getStoredValueWithKey(this.saltKey);
    let [, saltedPassword] = this.saltPassword(password, storedSalt);
    let saltedPasswordHash = this.hash(saltedPassword);

    const vault = await passworder.decrypt(saltedPasswordHash, encryptedVault);
    return [vault as PersistentVaultData, saltedPasswordHash];
  }

  /**
   * Helper function to convert a string into a Uint8array
   * @param {string} str to get bytes of
   */
  private stringToBytes(str: string) {
    return new TextEncoder().encode(str);
  }

  /**
   * Generate a salted password for hashing.
   * @param {string} password for salting.
   * @param  {Uint8Array} [salt=null] will use instead of random bytes if provided.
   * @returns {Uint8Array} Salt bytes.
   * @returns {Uint8Array} Salted password bytes.
   */
  private saltPassword(
    password: string,
    salt: Uint8Array | null = null
  ): [Uint8Array, Uint8Array] {
    let passwordSalt: Uint8Array;
    salt !== null
      ? (passwordSalt = Uint8Array.from(Object.values(salt)))
      : (passwordSalt = nacl.randomBytes(64));
    let passwordBytes = this.stringToBytes(password);
    let saltedPasswordBytes = new Uint8Array(
      passwordSalt.length + passwordBytes.length
    );
    saltedPasswordBytes.set(passwordSalt);
    saltedPasswordBytes.set(passwordBytes, passwordSalt.length);
    return [passwordSalt, saltedPasswordBytes];
  }

  /**
   * Hash given bytes and encodes in base16
   * @param {Uint8Array} bytes Bytes for hashing.
   * @returns {String} hex encoded hash.
   */
  private hash(bytes: Uint8Array) {
    let hashedBytes = nacl.hash(bytes);
    return encodeBase64(hashedBytes);
  }

  /*
   * user can lock the plugin manually, and then user need to use
   * password to unlock, so that the plugin won't be used by others
   */
  @action.bound
  async lock() {
    this.passwordHash = null;
    this.appState.isUnlocked = false;
    await this.clearAccount();
    updateStatusEvent(this.appState, 'locked');
  }

  /**
   * Using the password to unlock
   * @param {string} password
   */
  @action.bound
  async unlock(password: string) {
    if (this.appState.lockedOut) {
      throw new Error('Locked out please wait');
    }
    let vaultResponse;
    try {
      vaultResponse = await this.restoreVault(password);
    } catch (e) {
      this.appState.unlockAttempts -= 1;
      throw new Error(e);
    }
    let vault = vaultResponse[0];
    this.passwordHash = vaultResponse[1];
    this.resetLockout();
    this.appState.isUnlocked = true;
    this.appState.userAccounts.replace(
      vault.userAccounts.map(this.deserializeKeyPairWithAlias)
    );
    this.appState.selectedUserAccount = vault.selectedUserAccount
      ? this.deserializeKeyPairWithAlias(vault.selectedUserAccount)
      : null;

    updateStatusEvent(this.appState, 'unlocked');
  }

  @action
  refreshRemainingTime(minutesLeft: number) {
    if (minutesLeft <= 1) {
      this.appState.remainingMins = 1;
      return;
    }
    this.appState.remainingMins = minutesLeft;
    setTimeout(() => {
      this.refreshRemainingTime(minutesLeft - 1);
    }, 1000 * 60);
  }

  @action
  async startLockoutTimer(
    timeInMinutes: number,
    resetTimestamp: boolean = true
  ) {
    this.appState.lockoutTimerStarted = true;
    if (resetTimestamp) {
      let currentTimeMillis = new Date().getTime();
      this.timerStore.set({ lockedOutTimestampMillis: currentTimeMillis });
    }
    setTimeout(() => {
      this.resetLockout();
      this.resetLockoutTimer();
    }, timeInMinutes * 1000 * 60);
    this.refreshRemainingTime(timeInMinutes);
  }

  @action.bound
  async resetLockout() {
    this.timerStore.set({ lockedOutTimestampMillis: 0 });
    this.appState.unlockAttempts = 5;
  }

  @action.bound
  async resetLockoutTimer() {
    this.appState.lockoutTimerStarted = false;
  }

  @computed
  get isUnlocked(): boolean {
    return this.appState.isUnlocked;
  }

  async confirmPassword(password: string) {
    let encryptedVault = await this.getStoredValueWithKey(
      this.encryptedVaultKey
    );
    if (!encryptedVault) {
      throw new Error('There is no vault');
    }
    let storedSalt = await this.getStoredValueWithKey(this.saltKey);
    let [, saltedPassword] = this.saltPassword(password, storedSalt);
    let saltedPasswordHash = this.hash(saltedPassword);
    try {
      await passworder.decrypt(saltedPasswordHash, encryptedVault);
      return true;
    } catch (err) {
      throw new Error(err);
    }
  }

  @action.bound
  async clearAccount() {
    this.appState.userAccounts.clear();
  }
}

export default AuthController;
