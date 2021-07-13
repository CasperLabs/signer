import * as events from 'events';
import { AppState } from '../lib/MemStore';
import PopupManager from '../background/PopupManager';
import { DeployUtil, encodeBase16, CLPublicKey } from 'casper-js-sdk';

export type deployStatus = 'unsigned' | 'signed' | 'failed';
export interface deployWithID {
  id: number;
  status: deployStatus;
  deploy: DeployUtil.Deploy | undefined;
  signingKey: string;
  targetKey: string;
  error?: Error;
  pushed?: boolean;
}

export interface DeployData {
  deployHash: string;
  signingKey: string;
  account: string;
  timestamp: string;
  chainName: string;
  deployType: string;
  gasPrice: number;
  payment: string;
  id?: any;
  amount?: any;
  target?: string;
  recipient?: string;
  validator?: string;
  delegator?: string;
}

/**
 * Sign Message Manager
 *                      TODO: Update these docs
 * Algorithm:
 *    1. Injected script call `SignMessageManager.addUnsignedMessageAsync`, we return a Promise, inside the Promise, we will
 *       construct a message and assign it a unique id msgId and then we set up a event listen for `${msgId}:finished`.
 *       Resolve or reject when the event emits.
 *    2. Popup call `SignMessageManager.{rejectMsg|approveMsg}` either to reject or commit the signature request,
 *       and both methods will fire a event `${msgId}:finished`, which is listened by step 1.
 *
 * Important to Note:
 *    Any mention of CLPublicKey below will refer to the hex-encoded bytes of the Public Key prefixed with 01 or 02
 *    to denote the algorithm used to generate the key.
 *          01 - ed25519
 *          02 - secp256k1
 *
 */
export default class SignMessageManager extends events.EventEmitter {
  private unsignedDeploys: deployWithID[];
  private nextId: number;
  private popupManager: PopupManager;

  constructor(private appState: AppState) {
    super();
    this.unsignedDeploys = [];
    this.nextId = Math.round(Math.random() * Number.MAX_SAFE_INTEGER);
    this.popupManager = new PopupManager();
  }

  /**
   * Helper function to generate IDs to tag deploys with
   * @returns {number} id
   */
  private createId() {
    this.nextId = this.nextId % Number.MAX_SAFE_INTEGER;
    return this.nextId++;
  }

  /**
   * Checks given deploy for signatures
   * @param {DeployUtil.Deploy} deploy
   */
  private checkDeployForSignatures(deploy: DeployUtil.Deploy) {
    // TODO: Implement
  }

  /**
   * Update the AppState with the new list of unsigned deploys.
   * Pushes new state to popup.
   */
  private updateAppState() {
    this.appState.unsignedDeploys.replace(
      this.unsignedDeploys.filter(d => !d.pushed)
    );
    this.unsignedDeploys = this.unsignedDeploys.map(d => ({
      ...d,
      pushed: true
    }));
  }

  /**
   * Retrieve the active public key from vault.
   * Will reject if:
   *  - The Signer is not connected.
   *  - There is no account in the vault.
   * @returns Active public key - hex-encoded with algorithm prefix
   */
  public getActivePublicKey() {
    return new Promise<string>((resolve, reject) => {
      let publicKey = this.appState.selectedUserAccount?.KeyPair.publicKey;
      if (!this.appState.connectionStatus) {
        return reject(new Error('Please connect to the Signer to read key'));
      }
      if (!this.appState.isUnlocked || this.appState.lockedOut) {
        return reject(new Error('Please unlock the Signer to read key'));
      }
      if (!publicKey) {
        return reject(
          new Error(
            'Please create an account first before attempting to read key'
          )
        );
      }
      if (!publicKey.isEd25519 && !publicKey.isSecp256K1())
        reject(new Error('Key was not of expected format!'));
      return publicKey.toHex();
    });
  }
  /**
   * Adds the unsigned deploy to the app's queue.
   * @param {JSON} deployJson
   * @returns {number} id for added deploy
   */
  public addUnsignedDeployToQueue(
    deployJson: any,
    sourcePublicKey: string,
    targetPublicKey: string
  ): number {
    const id: number = this.createId();

    try {
      let innerDeploy = DeployUtil.deployFromJson(deployJson);
      this.unsignedDeploys.push({
        id: id,
        status: 'unsigned',
        deploy: innerDeploy,
        signingKey: sourcePublicKey,
        targetKey: targetPublicKey
      });
    } catch (err) {
      throw new Error(err);
    }

    this.updateAppState();
    return id;
  }

  /**
   * Signs unsigned deploys from the app's queue
   * @param {DeployUtil.Deploy} deploy
   * @param {string} publicKey in hex format with algorithm prefix byte.
   * @returns {JSON} Signed deploy in JSON format
   */
  public signDeploy(
    deploy: any,
    sourcePublicKeyHex: string, // hex-encoded PublicKey bytes with algo prefix
    targetPublicKeyHex: string
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      // TODO: Need to abstract it to reusable method
      const { currentTab, connectedSites } = this.appState;
      const connected =
        currentTab &&
        connectedSites.some(
          site => site.url === currentTab.url && site.isConnected
        );
      if (!connected) {
        return reject('This site is not connected');
      }

      // Adding the deploy to the queue will update the extension state and UI
      const deployId = this.addUnsignedDeployToQueue(
        deploy,
        sourcePublicKeyHex,
        targetPublicKeyHex
      );
      this.popupManager.openPopup('sign');
      // Await outcome of user interaction with popup.
      this.once(`${deployId}:finished`, (processedDeploy: deployWithID) => {
        switch (processedDeploy.status) {
          case 'signed':
            if (processedDeploy.deploy) {
              this.appState.unsignedDeploys.clear();
              return resolve(DeployUtil.deployToJson(processedDeploy.deploy)); // TODO: Return signed deploy JSON
            }
            this.appState.unsignedDeploys.remove(processedDeploy);
            return reject(new Error(processedDeploy.error?.message));
          case 'failed':
            this.unsignedDeploys = this.unsignedDeploys.filter(
              d => d.id !== processedDeploy.id
            );
            return reject(
              new Error(
                processedDeploy.error?.message! ?? 'User Cancelled Signing'
              )
            );
          default:
            return reject(
              new Error(
                `Signer: Unknown error occurred. Deploy data: ${processedDeploy.toString()}`
              )
            );
        }
      });
    });
  }

  /**
   * Sets the status and errors fields for the rejected deploy.
   * @param deployId ID to identify deploy from queue
   */
  public rejectSignDeploy(deployId: number) {
    const deployWithId = this.getDeployById(deployId);
    deployWithId.status = 'failed';
    deployWithId.error = new Error('User Cancelled Signing');
    this.appState.unsignedDeploys.clear();
    this.saveAndEmitEventIfNeeded(deployWithId);
    this.popupManager.closePopup();
  }

  // Approve signature request
  public async approveSignDeploy(deployId: number) {
    const deployData = this.getDeployById(deployId);
    if (!this.appState.selectedUserAccount) {
      throw new Error(`No Active Account!`);
    }
    let activeKeyPair = this.appState.selectedUserAccount.KeyPair;
    if (!deployData.deploy) {
      deployData.error = new Error('Cannot sign null deploy!');
      this.saveAndEmitEventIfNeeded(deployData);
      return;
    }

    // Reject if user switches keys during signing process
    if (
      deployData.signingKey &&
      activeKeyPair.publicKey.toHex() !== deployData.signingKey
    ) {
      deployData.status = 'failed';
      deployData.error = new Error('Active key changed during signing');
      this.saveAndEmitEventIfNeeded(deployData);
      return;
    }

    DeployUtil.signDeploy(deployData.deploy, activeKeyPair);

    deployData.status = 'signed';
    this.saveAndEmitEventIfNeeded(deployData);
  }

  /**
   * Get deploy from queue by ID
   * @param deployId
   * @throws Error if there is no deploy with the given ID.
   */
  private getDeployById(deployId: number): deployWithID {
    let deployWithId = this.appState.unsignedDeploys.find(
      data => data.id === deployId
    );
    if (deployWithId === undefined) {
      throw new Error(`Could not find deploy with id: ${deployId}`);
    }
    return deployWithId;
  }

  public parseDeployData(deployId: number): DeployData {
    let deployWithID = this.getDeployById(deployId);
    if (deployWithID !== undefined && deployWithID.deploy !== undefined) {
      let header = deployWithID.deploy.header;

      // TODO: Double-check that this is correct way to determine deploy type.
      const type = deployWithID.deploy.isTransfer()
        ? 'Transfer'
        : deployWithID.deploy.session.isModuleBytes()
        ? 'Contract Call'
        : 'Contract Deployment';

      let amount, target, recipient, validator, delegator;

      if (deployWithID.deploy.session.transfer) {
        // First let's check if the provided targetPublicKey matches the one used in deploy
        // We're doing it because its impossible to extract target in a form of PublicKey from Deploy
        const providedTargetKeyHash = encodeBase16(
          CLPublicKey.fromHex(deployWithID.targetKey).toAccountHash()
        );

        const deployTargetKeyHash = encodeBase16(
          deployWithID.deploy.session.transfer?.getArgByName('target')!.value()
        );

        if (providedTargetKeyHash !== deployTargetKeyHash) {
          throw new Error(
            "Provided target public key doesn't match the one in deploy"
          );
        }

        const targetByteArray = deployWithID.deploy.session.transfer
          ?.getArgByName('target')!
          .value()
          .toString();

        target = encodeBase16(targetByteArray);

        recipient = deployWithID.targetKey;

        amount = deployWithID.deploy.session.transfer
          ?.getArgByName('amount')!
          .value()
          .toString();
      }

      if (deployWithID.deploy.session.storedContractByHash) {
        amount = deployWithID.deploy.session.storedContractByHash
          ?.getArgByName('amount')!
          .value()
          .toString();

        validator = (
          deployWithID.deploy.session.storedContractByHash?.getArgByName(
            'validator'
          )! as CLPublicKey
        ).toHex();

        delegator = (
          deployWithID.deploy.session.storedContractByHash?.getArgByName(
            'delegator'
          )! as CLPublicKey
        ).toHex();
      }

      const transferId = deployWithID.deploy.session.transfer
        ?.getArgByName('id')!
        .value()
        .unwrap()
        .value()
        .toString();

      const deployAccount = header.account.toHex();
      const payment = encodeBase16(
        deployWithID.deploy.payment.toBytes().unwrap()
      );
      return {
        deployHash: encodeBase16(deployWithID.deploy.hash),
        signingKey: deployWithID.signingKey,
        account: deployAccount,
        chainName: header.chainName,
        timestamp: new Date(header.timestamp).toLocaleString(),
        gasPrice: header.gasPrice,
        payment: payment,
        deployType: type,
        id: transferId,
        amount: amount,
        target: target,
        recipient: recipient,
        validator: validator,
        delegator: delegator
      };
    } else {
      throw new Error();
    }
  }

  private saveAndEmitEventIfNeeded(deployWithId: deployWithID) {
    let status = deployWithId.status;
    this.updateDeployWithId(deployWithId);
    if (status === 'failed' || status === 'signed') {
      // fire finished event, so that the Promise can resolve and return result to RPC caller
      this.emit(`${deployWithId.id}:finished`, deployWithId);
    }
  }

  private updateDeployWithId(deployWithId: deployWithID) {
    const index = this.unsignedDeploys.findIndex(
      deployData => deployData.id === deployWithId.id
    );
    if (index === -1) {
      throw new Error(`Could not find message with id: ${deployWithId.id}`);
    }
    this.unsignedDeploys[index] = deployWithId;
    this.updateAppState();
  }
}
