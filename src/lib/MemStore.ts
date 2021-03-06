import { IObservableArray, observable, computed } from 'mobx';
import { Tab, Site } from '../background/ConnectionManager';
import { KeyPairWithAlias } from '../@types/models';
import { deployWithID } from '../background/SignMessageManager';

export class AppState {
  @observable isUnlocked: boolean = false;
  @observable currentTab: Tab | null = null;
  @computed get connectionStatus(): boolean {
    const url = this.currentTab && this.currentTab.url;
    if (url) {
      return this.connectedSites.some(
        site => site.url === url && site.isConnected
      );
    }
    return false;
  }
  @observable connectionRequested: boolean = false;
  @observable connectedSites: IObservableArray<Site> = observable.array<Site>(
    [],
    { deep: true }
  );
  @observable hasCreatedVault: boolean = false;
  @observable selectedUserAccount: KeyPairWithAlias | null = null;
  userAccounts: IObservableArray<KeyPairWithAlias> =
    observable.array<KeyPairWithAlias>([], { deep: true });
  @observable unsignedDeploys: IObservableArray<deployWithID> =
    observable.array<deployWithID>([], { deep: true });
}
