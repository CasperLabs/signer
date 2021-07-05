import AccountController from './AuthController';
import { browser } from 'webextension-polyfill-ts';
import { Rpc } from '../lib/rpc/rpc';
import { AppState } from '../lib/MemStore';
import { autorun } from 'mobx';
import SignMessageManager from './SignMessageManager';
import ConnectionManager from './ConnectionManager';
import { updateBadge } from './utils';
import { setupInjectPageAPIServer } from '../lib/rpc/Provider';

const appState = new AppState();
const accountController = new AccountController(appState);
const signMessageManager = new SignMessageManager(appState);
const connectionManager = new ConnectionManager(appState);

initialize().catch(console.log);

async function initialize() {
  await setupPopupAPIServer();
  // Setup RPC server for inject page
  setupInjectPageAPIServer(signMessageManager, connectionManager);
}

// Setup RPC server for Popup
async function setupPopupAPIServer() {
  const rpc = new Rpc({
    addListener: browser.runtime.onMessage.addListener,
    destination: 'popup',
    postMessage: browser.runtime.sendMessage,
    source: 'background'
  });
  // once appState update, send updated appState to popup
  autorun(() => {
    rpc.call<void>('popup.updateState', appState).catch(e => {
      console.log(e);
    });
    updateBadge(appState);
  });
  rpc.register(
    'account.unlock',
    accountController.unlock.bind(accountController)
  );
  rpc.register(
    'account.createNewVault',
    accountController.createNewVault.bind(accountController)
  );
  rpc.register('account.lock', accountController.lock.bind(accountController));
  rpc.register(
    'account.importUserAccount',
    accountController.importUserAccount.bind(accountController)
  );
  rpc.register(
    'account.removeUserAccount',
    accountController.removeUserAccount.bind(accountController)
  );
  rpc.register(
    'account.renameUserAccount',
    accountController.renameUserAccount.bind(accountController)
  );
  rpc.register(
    'account.reorderAccount',
    accountController.reorderAccount.bind(accountController)
  );
  rpc.register(
    'account.getSelectUserAccount',
    accountController.getSelectUserAccount.bind(accountController)
  );
  rpc.register(
    'account.getActivePublicKeyHex',
    accountController.getActivePublicKeyHex.bind(accountController)
  );
  rpc.register(
    'account.getActiveAccountHash',
    accountController.getActiveAccountHash.bind(accountController)
  );
  rpc.register(
    'account.downloadAccountKeys',
    accountController.downloadAccountKeys.bind(accountController)
  );
  rpc.register(
    'account.resetVault',
    accountController.resetVault.bind(accountController)
  );
  rpc.register(
    'account.resetLockout',
    accountController.resetLockout.bind(accountController)
  );
  rpc.register(
    'account.startLockoutTimer',
    accountController.startLockoutTimer.bind(accountController)
  );
  rpc.register(
    'account.resetLockoutTimer',
    accountController.resetLockoutTimer.bind(accountController)
  );
  rpc.register(
    'account.switchToAccount',
    accountController.switchToAccount.bind(accountController)
  );
  rpc.register('background.getState', () => {
    return appState;
  });
  rpc.register(
    'sign.signDeploy',
    signMessageManager.approveSignDeploy.bind(signMessageManager)
  );
  rpc.register(
    'sign.rejectSignDeploy',
    signMessageManager.rejectSignDeploy.bind(signMessageManager)
  );
  rpc.register(
    'sign.parseDeployData',
    signMessageManager.parseDeployData.bind(signMessageManager)
  );
  rpc.register(
    'connection.requestConnection',
    connectionManager.requestConnection.bind(connectionManager)
  );
  rpc.register(
    'connection.resetConnectionRequest',
    connectionManager.resetConnectionRequest.bind(connectionManager)
  );
  rpc.register(
    'connection.connectToSite',
    connectionManager.connectToSite.bind(connectionManager)
  );
  rpc.register(
    'connection.disconnectFromSite',
    connectionManager.disconnectFromSite.bind(connectionManager)
  );
  rpc.register(
    'connection.removeSite',
    connectionManager.removeSite.bind(connectionManager)
  );
  rpc.register(
    'eventBus',
    connectionManager.removeSite.bind(connectionManager)
  );
  rpc.register(
    'account.confirmPassword',
    accountController.confirmPassword.bind(accountController)
  );
}
