import { registerClient } from '../lib/rpc/client';

// See README.md for details
class CasperLabsPluginHelper {
  private readonly call: <RESULT>(
    method: string,
    ...params: any[]
  ) => Promise<RESULT>;

  constructor() {
    this.call = registerClient();
  }

  async isConnected() {
    return this.call<boolean>('isConnected');
  }

  async requestConnection() {
    return this.call<void>('requestConnection');
  }

  async disconnectFromSite() {
    return this.call<void>('disconnectFromSite');
  }

  async removeSite() {
    return this.call<void>('removeSite');
  }

  async sign(deploy: JSON, sourcePublicKey: string, targetPublicKey: string) {
    return this.call<string>('sign', deploy, sourcePublicKey, targetPublicKey);
  }

  async getActivePublicKey() {
    return this.call<string>('getActivePublicKey');
  }

  async getVersion() {
    return this.call<string>('getVersion');
  }

  async eventBus() {
    return this.call<any>('eventBus');
  }
}

// inject to window, so that Clarity code could use it.
(window as any).casperlabsHelper = new CasperLabsPluginHelper();
