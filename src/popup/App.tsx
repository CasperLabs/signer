import React from 'react';
// see https://github.com/mobxjs/mobx-react-lite/#observer-batching
import 'mobx-react-lite/batchingForReactDom';
import './App.scss';
import { Route, Switch } from 'react-router-dom';
import Pages from './components/Pages';
import Home from './components/Home';
import AccountManager from './container/AccountManager';
import PopupManager from '../background/PopupManager';
import { HomeContainer } from './container/HomeContainer';
import { observer } from 'mobx-react';
import ErrorContainer from './container/ErrorContainer';
import SignMessagePage from './components/SignMessagePage';
import SignMessageContainer from './container/SignMessageContainer';
import ConnectSignerPage from './components/ConnectSignerPage';
import ConnectSignerContainer from './container/ConnectSignerContainer';
import AccountPage from './components/AccountPage';
import { Alert, AlertTitle } from '@material-ui/lab';
import { Container } from '@material-ui/core';
import { MainAppBar } from './components/MainAppBar';
import AnalyticsProvider from './components/AnalyticsProvider';
import AccountManagementPage from './components/AccountManagementPage';
import { ConnectedSitesPage } from './components/ConnectedSitesPage';
import IdleTimer from 'react-idle-timer';

export interface AppProps {
  errors: ErrorContainer;
  authContainer: AccountManager;
  popupManager: PopupManager;
  homeContainer: HomeContainer;
  signMessageContainer: SignMessageContainer;
  connectSignerContainer: ConnectSignerContainer;
}

const App = (props: AppProps) => {
  const lockOnIdle = () => {
    if (props.authContainer.isUnLocked) props.authContainer.lock();
  };

  return (
    <div>
      {/* TODO
      Lockout time is hardcoded here but this could be made configurable
      to allow users to set convenient timeouts.
      */}
      <IdleTimer timeout={30000} onIdle={lockOnIdle} debounce={250} />
      <AnalyticsProvider />
      <MainAppBar
        authContainer={props.authContainer}
        connectionContainer={props.connectSignerContainer}
      />
      <Container>
        <Alerts {...props} />
        <Switch>
          <Route
            exact
            path={Pages.Home}
            render={_ => (
              <Home
                authContainer={props.authContainer}
                homeContainer={props.homeContainer}
                connectionContainer={props.connectSignerContainer}
                popupManager={props.popupManager}
                errors={props.errors}
              />
            )}
          />
          <Route
            exact
            path={Pages.AccountManagement}
            render={_ => (
              <AccountManagementPage
                authContainer={props.authContainer}
                connectionContainer={props.connectSignerContainer}
              />
            )}
          />
          <Route
            exact
            path={Pages.ConnectedSites}
            render={_ => (
              <ConnectedSitesPage
                connectionContainer={props.connectSignerContainer}
              />
            )}
          />
          <Route
            path={Pages.ImportAccount}
            exact
            render={_ => (
              <AccountPage
                errors={props.errors}
                action={'Import'}
                authContainer={props.authContainer}
              />
            )}
          />
          <Route
            path={Pages.CreateAccount}
            exact
            render={_ => (
              <AccountPage
                errors={props.errors}
                action={'Create'}
                authContainer={props.authContainer}
              />
            )}
          />
          <Route
            path={Pages.SignMessage}
            exact
            render={_ => (
              <SignMessagePage
                signMessageContainer={props.signMessageContainer}
                authContainer={props.authContainer}
              />
            )}
          />
          <Route
            path={Pages.ConnectSigner}
            exact
            render={_ => (
              <ConnectSignerPage
                connectSignerContainer={props.connectSignerContainer}
              />
            )}
          />
        </Switch>
      </Container>
    </div>
  );
};

export default App;

// Alerts displays the outcome of the last async error on the top of the page.
// Dismissing the error clears the state and removes the element.
const Alerts = observer((props: AppProps) => {
  if (props.errors.lastError == null) return null;
  // Not using the `data-dismiss="alert"` to dismiss via Bootstrap JS
  // becuase then it doesn't re-render when there's a new error.
  return (
    <div id="alert-message">
      <Alert severity="error" onClose={() => props.errors.dismissLast()}>
        <AlertTitle>Error!</AlertTitle>
        {props.errors.lastError}
      </Alert>
    </div>
  );
});
