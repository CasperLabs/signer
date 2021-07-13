import { AppState } from '../../lib/MemStore';
import { BackgroundManager } from '../BackgroundManager';
import { computed } from 'mobx';
import { browser } from 'webextension-polyfill-ts';

class ConnectSignerContainer {
  constructor(
    private backgroundManager: BackgroundManager,
    private appState: AppState
  ) {}

  @computed
  get connectionStatus() {
    return this.appState.connectionStatus;
  }

  @computed
  get connectionRequested() {
    return this.appState.connectionRequested;
  }

  async connectToSite(url?: string) {
    await this.backgroundManager.connectToSite(url);
    await this.resetConnectionRequest();
  }

  async disconnectFromSite(site?: string) {
    await this.backgroundManager.disconnectFromSite(site);
    await this.resetConnectionRequest();
  }

  async removeSite(url: string) {
    await this.backgroundManager.removeSite(url);
    await this.resetConnectionRequest();
  }

  async resetConnectionRequest() {
    await this.backgroundManager.resetConnectionRequest();
  }

  async cancel() {
    await this.resetConnectionRequest();
    await this.closeWindow();
  }

  async open() {
    await this.openWindow();
  }

  private async closeWindow() {
    let views = await browser.extension.getViews();
    let popup = views[1].window;
    popup.close();
  }

  private async openWindow() {
    let views = await browser.extension.getViews();
    let popup = views[1].window;
    popup.open();
  }

  @computed
  get connectedSites() {
    return this.appState.connectedSites;
  }

  @computed
  get currentTab() {
    return this.appState.currentTab;
  }

  // Is the current site injected with the content script?
  // And therefore is it a valid integrated client.
  // Based on the list of URLs from the extension manifest.json
  async isIntegratedSite(hostname: string) {
    return await this.backgroundManager.isIntegratedSite(hostname);
  }

  @computed
  get integratedSite() {
    return this.appState.isIntegratedSite;
  }
}

export default ConnectSignerContainer;
