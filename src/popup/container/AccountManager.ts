import { action, computed, IObservableArray } from 'mobx';
import { BackgroundManager } from '../BackgroundManager';
import ErrorContainer from './ErrorContainer';
import { AppState } from '../../lib/MemStore';
import { KeyPairWithAlias } from '../../@types/models';

class AccountManager {
  constructor(
    private errors: ErrorContainer,
    private backgroundManager: BackgroundManager,
    private appState: AppState
  ) {}

  async createNewVault(password: string) {
    await this.errors.withCapture(
      this.backgroundManager.createNewVault(password)
    );
  }

  async importUserAccount(
    name: string,
    secretKeyBase64: string,
    algorithm: string
  ) {
    return this.backgroundManager.importUserAccount(
      name,
      secretKeyBase64,
      algorithm
    );
  }

  async removeUserAccount(name: string) {
    return this.backgroundManager.removeUserAccount(name);
  }

  async reorderAccount(startIndex: number, endIndex: number) {
    // the data flow is always from background to frontend.
    // we need do reorder operations on both background and frontend side,
    // so that UI won't get jitter
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
    return this.backgroundManager.reorderAccount(startIndex, endIndex);
  }

  switchToAccount(accountName: string) {
    return this.backgroundManager.switchToAccount(accountName);
  }

  @computed
  get userAccounts(): IObservableArray<KeyPairWithAlias> {
    return this.appState.userAccounts;
  }

  async downloadPemFiles(accountAlias: string) {
    // Save the secret and public keys to disk.
    this.backgroundManager.downloadAccountKeys(accountAlias);
  }

  async downloadActiveKey() {
    let userAccount = await this.backgroundManager.getSelectUserAccount();
    // Save the secret and public keys to disk.
    this.downloadPemFiles(userAccount.alias);
  }

  async getSelectedAccountKey(acctName: string) {
    await this.backgroundManager.switchToAccount(acctName);
    let account = await this.backgroundManager.getSelectUserAccount();
    return account.KeyPair.publicKey;
  }

  async getPublicKeyHex(accountName: string) {
    await this.backgroundManager.switchToAccount(accountName);
    return this.backgroundManager.getActivePublicKeyHex();
  }

  async getAccountHash(accountName: string) {
    await this.backgroundManager.switchToAccount(accountName);
    return this.backgroundManager.getActiveAccountHash();
  }

  async lock() {
    return this.backgroundManager.lock();
  }

  async unlock(password: string) {
    return this.backgroundManager.unlock(password);
  }

  @computed
  get hasCreatedVault(): boolean {
    return this.appState.hasCreatedVault;
  }

  @action
  async resetVault() {
    return this.backgroundManager.resetVault();
  }

  @computed
  get isUnLocked(): boolean {
    return this.appState.isUnlocked;
  }

  @computed
  get selectedUserAccount() {
    return this.appState.selectedUserAccount;
  }

  @computed
  get unsignedDeploys() {
    return this.appState.unsignedDeploys;
  }

  async renameUserAccount(oldName: string, newName: string) {
    return this.backgroundManager.renameUserAccount(oldName, newName);
  }
}

export default AccountManager;
