import AuthController from './AuthController';
import { AppState } from '../lib/MemStore';
import { encodeBase64 } from 'tweetnacl-ts';
import { storage } from '@extend-chrome/storage';
import { Keys } from 'casper-js-sdk';
import { KeyPairWithAlias } from '../@types/models';

jest.mock('@extend-chrome/storage', () => {
  const memoryStore = new Map();

  return {
    storage: {
      local: {
        get: (key: string): any => {
          return { [key]: memoryStore.get(key) };
        },
        set: (v: any): any => {
          const key = Object.keys(v)[0];
          const val = v[key];
          memoryStore.set(key, val);
        },
        remove: (key: string): void => {
          memoryStore.delete(key);
        }
      }
    }
  };
});

// jsdom haven't implement crypto, which is highly used by browser-passworder, so we mock this library here.
jest.mock('browser-passworder', () => {
  return {
    encrypt: (password: string, data: any): any => {
      let toEncodeObj = {
        data: data,
        password: password
      };
      return JSON.stringify(toEncodeObj);
    },
    decrypt: (password: string, dataStr: string): any => {
      let obj = JSON.parse(dataStr);
      if (obj.password !== password) {
        throw new Error();
      }
      return obj.data;
    }
  };
});

jest.mock('webextension-polyfill-ts', () => ({ browser: {} }));

describe('AuthController', () => {
  let appState: AppState;
  let authController: AuthController;
  const password = 'correct_password';
  const wrongPassword = 'wrong_password';

  beforeEach(async () => {
    appState = new AppState();
    authController = new AuthController(appState);
    storage.local.remove('encryptedVault');
    await expect(
      authController.createNewVault(password)
    ).resolves.toBeUndefined();
  });

  test('it should be able to create a new vault only once with password', async () => {
    await expect(authController.createNewVault(password)).rejects.toThrow();
  });

  test('it should be able to lock and unlock using correct password', async () => {
    expect(authController.isUnlocked).toBeTruthy();
    await authController.lock();
    expect(authController.isUnlocked).toBeFalsy();
    await expect(authController.unlock(wrongPassword)).rejects.toThrow();
    await authController.unlock(password);
    expect(authController.isUnlocked).toBeTruthy();

    await expect(
      authController.importUserAccount(
        'account1',
        encodeBase64(Keys.Ed25519.new().privateKey),
        Keys.SignatureAlgorithm.Ed25519
      )
    ).resolves.toBeUndefined();

    await authController.lock();
    await authController.unlock(password);
    expect(authController.isUnlocked).toBeTruthy();
  });

  it('should allow 5 password attempts and then lock out', async () => {
    for (let i = 5; i > -1; i--) {
      expect(appState.unlockAttempts).toEqual(i);
      try {
        await authController.unlock(wrongPassword);
      } catch (e) {
        if (i === 0) {
          expect(e.message).toBe('Locked out please wait');
        } else {
          expect(appState.unlockAttempts).toEqual(i - 1);
        }
      }
    }
    // After 5 failed attempts user should be locked out
    expect(appState.lockedOut).toBeTruthy();
    await authController.resetLockout();
    expect(appState.unlockAttempts).toEqual(5);
    expect(appState.lockedOut).toBeFalsy();
  });

  it('should be able to save and restore userAccounts and selectUserAccount information', async () => {
    await authController.importUserAccount(
      'account1',
      encodeBase64(Keys.Ed25519.new().privateKey),
      Keys.SignatureAlgorithm.Ed25519
    );
    await expect(
      authController.importUserAccount(
        'account2',
        encodeBase64(Keys.Secp256K1.new().privateKey),
        Keys.SignatureAlgorithm.Secp256K1
      )
    ).resolves.toBeUndefined;

    // restore from storage
    const anotherState = new AppState();
    const anotherAuthContainer = new AuthController(anotherState);
    await anotherAuthContainer.unlock(password);

    // jest.toEqual is deep equal
    expect(anotherState.userAccounts).toEqual(appState.userAccounts);
    expect(anotherState.selectedUserAccount).toEqual(
      appState.selectedUserAccount
    );
  });

  it('should change active key, lock and unlock again', async () => {
    // Starts unlocked
    let newAccount = Keys.Ed25519.new();
    await expect(
      authController.importUserAccount(
        'newAccount',
        encodeBase64(newAccount.privateKey),
        newAccount.signatureAlgorithm
      )
    ).resolves.toBeUndefined;
    authController.switchToAccount('newAccount');
    authController.lock();
    authController.unlock(password);
    expect(appState.selectedUserAccount?.alias).toEqual('newAccount');
  });

  it('should rename active key, lock and unlock again', async () => {
    // Starts unlocked
    let newAccount = Keys.Ed25519.new();
    await expect(
      authController.importUserAccount(
        'oldName',
        encodeBase64(newAccount.privateKey),
        newAccount.signatureAlgorithm
      )
    ).resolves.toBeUndefined;
    let activeAccount = authController.getSelectUserAccount();
    expect(activeAccount.KeyPair).toStrictEqual(newAccount);
    expect(activeAccount.alias).toEqual('oldName');
    await authController.renameUserAccount('oldName', 'newName');
    expect(activeAccount.alias).toEqual('newName');
    await authController.lock();
    expect(appState.isUnlocked).toBeFalsy();
    await authController.unlock(password);
    expect(authController.getSelectUserAccount().KeyPair).toStrictEqual(
      newAccount
    );
    expect(authController.getSelectUserAccount().alias).toEqual('newName');
  });

  describe('Handling ED25519 keys...', () => {
    it('should be able to add new account and fail if either name or secret key is duplicated', async () => {
      let keyPair1 = Keys.Ed25519.new();
      let keyPair2 = Keys.Ed25519.new();
      let duplicateAccountName = 'account1';

      await expect(
        authController.importUserAccount(
          duplicateAccountName,
          encodeBase64(keyPair1.privateKey),
          keyPair1.signatureAlgorithm
        )
      ).resolves.toBeUndefined;
      await expect(
        authController.importUserAccount(
          duplicateAccountName,
          encodeBase64(keyPair2.privateKey),
          keyPair2.signatureAlgorithm
        )
      ).rejects.toThrow(/same name/g);
      await expect(
        authController.importUserAccount(
          'new name',
          encodeBase64(keyPair1.privateKey),
          keyPair1.signatureAlgorithm
        )
      ).rejects.toThrow(/same secret key/g);
    });

    it('should be able to switch account by account name', async () => {
      const switchAccount1: KeyPairWithAlias = {
        alias: 'Account1',
        KeyPair: Keys.Ed25519.new()
      };
      const switchAccount2: KeyPairWithAlias = {
        alias: 'Account2',
        KeyPair: Keys.Ed25519.new()
      };
      await authController.importUserAccount(
        switchAccount1.alias,
        encodeBase64(switchAccount1.KeyPair.privateKey),
        switchAccount1.KeyPair.signatureAlgorithm
      );
      await authController.importUserAccount(
        switchAccount2.alias,
        encodeBase64(switchAccount2.KeyPair.privateKey),
        switchAccount2.KeyPair.signatureAlgorithm
      );

      expect(appState.selectedUserAccount).toStrictEqual(switchAccount2);

      authController.switchToAccount(switchAccount1.alias);
      expect(appState.selectedUserAccount).toStrictEqual(switchAccount1);

      expect(() => {
        authController.switchToAccount('not_exist');
      }).toThrow(/doesn't exist/g);
    });

    it('Key should serialise/deserialise correctly', async () => {
      let keyPair = Keys.Ed25519.new();
      await authController.importUserAccount(
        'newAccount',
        encodeBase64(keyPair.privateKey),
        keyPair.signatureAlgorithm
      );
      await authController.lock();
      expect(authController.isUnlocked).toBeFalsy();
      await authController.unlock(password);
      expect(authController.isUnlocked).toBeTruthy();
      expect(authController.getSelectUserAccount().KeyPair).toStrictEqual(
        keyPair
      );
    });

    it('Check SDK Keys tooling', () => {
      let keyPair = Keys.Ed25519.new();
      authController.importUserAccount(
        'account',
        encodeBase64(keyPair.privateKey),
        keyPair.signatureAlgorithm
      );
      let account = authController.getSelectUserAccount();
      expect(keyPair.publicKey.toHex()).toEqual(
        account.KeyPair.publicKey.toHex()
      );
      expect(keyPair.publicKey.toAccountHash()).toEqual(
        account.KeyPair.publicKey.toAccountHash()
      );
    });

    // This test will need to mock the downloadAccountKeys method as it
    // requires user input - fileSaver.js
    // it('Should save key and read it back correctly', async () => {
    //   let keyPair = Keys.Ed25519.new();
    //   await authController.importUserAccount(
    //     'account',
    //     encodeBase64(keyPair.privateKey),
    //     keyPair.signatureAlgorithm
    //   );
    // });
  });

  describe('Handling SECP256k1 keys...', () => {
    it('should be able to add new account and fail if either name or secret key is duplicated', async () => {
      let keyPair1 = Keys.Secp256K1.new();
      let keyPair2 = Keys.Secp256K1.new();
      let duplicateAccountName = 'account1';

      await expect(
        authController.importUserAccount(
          duplicateAccountName,
          encodeBase64(keyPair1.privateKey),
          keyPair1.signatureAlgorithm
        )
      ).resolves.toBeUndefined;
      await expect(
        authController.importUserAccount(
          duplicateAccountName,
          encodeBase64(keyPair2.privateKey),
          keyPair2.signatureAlgorithm
        )
      ).rejects.toThrow(/same name/g);
      await expect(
        authController.importUserAccount(
          'new name',
          encodeBase64(keyPair1.privateKey),
          keyPair1.signatureAlgorithm
        )
      ).rejects.toThrow(/same secret key/g);
    });

    it('should be able to switch account by account name', async () => {
      const switchAccount1: KeyPairWithAlias = {
        alias: 'Account1',
        KeyPair: Keys.Secp256K1.new()
      };
      const switchAccount2: KeyPairWithAlias = {
        alias: 'Account2',
        KeyPair: Keys.Secp256K1.new()
      };
      await authController.importUserAccount(
        switchAccount1.alias,
        encodeBase64(switchAccount1.KeyPair.privateKey),
        switchAccount1.KeyPair.signatureAlgorithm
      );
      await authController.importUserAccount(
        switchAccount2.alias,
        encodeBase64(switchAccount2.KeyPair.privateKey),
        switchAccount2.KeyPair.signatureAlgorithm
      );

      expect(appState.selectedUserAccount).toStrictEqual(switchAccount2);

      authController.switchToAccount(switchAccount1.alias);
      expect(appState.selectedUserAccount).toStrictEqual(switchAccount1);

      expect(() => {
        authController.switchToAccount('not_exist');
      }).toThrow(/doesn't exist/g);
    });

    it('Key should serialise/deserialise correctly', async () => {
      let keyPair = Keys.Secp256K1.new();
      await authController.importUserAccount(
        'newAccount',
        encodeBase64(keyPair.privateKey),
        keyPair.signatureAlgorithm
      );
      await authController.lock();
      expect(authController.isUnlocked).toBeFalsy();
      await authController.unlock(password);
      expect(authController.isUnlocked).toBeTruthy();
      expect(
        authController.getSelectUserAccount().KeyPair.privateKey
      ).toStrictEqual(keyPair.privateKey);
    });

    it('Check SDK Keys tooling', () => {
      let keyPair = Keys.Secp256K1.new();
      authController.importUserAccount(
        'account',
        encodeBase64(keyPair.privateKey),
        keyPair.signatureAlgorithm
      );
      let account = authController.getSelectUserAccount();
      expect(keyPair.publicKey.toHex()).toEqual(
        account.KeyPair.publicKey.toHex()
      );
      expect(keyPair.publicKey.toAccountHash()).toEqual(
        account.KeyPair.publicKey.toAccountHash()
      );
    });

    // This test will need to mock the downloadAccountKeys method as it
    // requires user input - fileSaver.js
    // it('Should save key and read it back correctly', async () => {
    //   let keyPair = Keys.Secp256k1.new();
    //   await authController.importUserAccount(
    //     'account',
    //     encodeBase64(keyPair.privateKey),
    //     keyPair.signatureAlgorithm
    //   );
    // });
  });
});
