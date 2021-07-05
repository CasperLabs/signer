import { action, computed, IObservableArray } from 'mobx';
import { BackgroundManager } from '../BackgroundManager';
import ErrorContainer from './ErrorContainer';
import { AppState } from '../../lib/MemStore';
import { KeyPairWithAlias } from '../../@types/models';
import { FieldState, FormState } from 'formstate';
import { valueRequired } from '../../lib/FormValidator';

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

  @computed
  get remainingUnlockAttempts() {
    return this.appState.unlockAttempts;
  }

  @computed
  get isLockedOut() {
    return this.appState.lockedOut;
  }

  @action
  async resetLockout() {
    return this.backgroundManager.resetLockout();
  }

  @action
  async startLockoutTimer(timeInMinutes: number) {
    return this.backgroundManager.startLockoutTimer(timeInMinutes);
  }

  @computed
  get lockoutTimerStarted() {
    return this.appState.lockoutTimerStarted;
  }

  @computed
  get timerDuration() {
    return this.appState.timerDurationMins;
  }

  @computed
  get remainingMins() {
    return this.appState.remainingMins;
  }

  @action
  async resetLockoutTimer() {
    return this.backgroundManager.resetLockoutTimer();
  }

  async renameUserAccount(oldName: string, newName: string) {
    return this.backgroundManager.renameUserAccount(oldName, newName);
  }

  async confirmPassword(password: string) {
    return this.backgroundManager.confirmPassword(password);
  }

  confirmPasswordForm = new FormState({
    confirmPasswordField: new FieldState<string>('').validators(valueRequired)
  });

  @computed
  get confirmPasswordDisabled(): boolean {
    let disabled =
      !this.confirmPasswordForm.$.confirmPasswordField.hasBeenValidated ||
      (this.confirmPasswordForm.$.confirmPasswordField.hasBeenValidated &&
        this.confirmPasswordForm.$.confirmPasswordField.hasError);
    return disabled;
  }
}

export default AccountManager;
