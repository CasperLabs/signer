import React from 'react';
import logo from '../img/CasperLabs_Logo_Favicon_RGB_50px.png';
import {
  Button,
  createStyles,
  FormControl,
  Theme,
  WithStyles,
  Typography,
  withStyles,
  Grid
} from '@material-ui/core';
import AddCircleIcon from '@material-ui/icons/AddCircle';
import { Link, Redirect } from 'react-router-dom';
import AccountManager from '../container/AccountManager';
import PopupManager from '../../background/PopupManager';
import { HomeContainer } from '../container/HomeContainer';
import ConnectSignerContainer from '../container/ConnectSignerContainer';
import ErrorContainer from '../container/ErrorContainer';
import { observer } from 'mobx-react';
import Pages from './Pages';
import { confirm } from './Confirmation';
import { RouteComponentProps, withRouter } from 'react-router';
import { TextFieldWithFormState } from './Forms';

/* eslint-disable jsx-a11y/anchor-is-valid */
const styles = (theme: Theme) =>
  createStyles({
    margin: {
      marginTop: '20px'
    },
    alignCenter: {
      textAlign: 'center'
    },
    unlockButton: {
      backgroundColor: 'var(--cspr-dark-blue)',
      color: 'white',
      '&$disabled': {
        backgroundColor: 'white',
        color: 'grey'
      }
    },
    disabled: {}
  });

interface Props extends RouteComponentProps, WithStyles<typeof styles> {
  authContainer: AccountManager;
  homeContainer: HomeContainer;
  connectionContainer: ConnectSignerContainer;
  popupManager: PopupManager;
  errors: ErrorContainer;
}

@observer
class Home extends React.Component<Props, {}> {
  renderCreateNewVault() {
    return (
      <div>
        <Grid
          container
          spacing={4}
          direction={'column'}
          justify={'flex-start'}
          alignItems={'center'}
        >
          <Grid item className={this.props.classes.alignCenter}>
            <img src={logo} alt="logo" width={80} />
            <Typography variant={'h6'} align={'center'}>
              New Vault
            </Typography>
            <Typography>
              Please set a password for your vault. You will need it later to
              unlock it so keep it safe.
            </Typography>
          </Grid>

          <Grid item container>
            <form style={{ textAlign: 'center' }}>
              <FormControl fullWidth>
                <TextFieldWithFormState
                  fieldState={
                    this.props.homeContainer.homeForm.$.setPasswordField
                  }
                  required
                  label={'Set Password'}
                  type={'password'}
                />
              </FormControl>
              <FormControl fullWidth>
                <TextFieldWithFormState
                  fieldState={
                    this.props.homeContainer.homeForm.$.confirmPasswordField
                  }
                  required
                  label={'Confirm Password'}
                  type={'password'}
                />
              </FormControl>
              <Typography variant="subtitle2" className="text-danger">
                {this.props.homeContainer.homeForm.showFormError &&
                  this.props.homeContainer.homeForm.formError}
              </Typography>
              <FormControl fullWidth className={this.props.classes.margin}>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  disabled={this.props.homeContainer.createVaultDisabled}
                  onClick={async () => {
                    const password =
                      this.props.homeContainer.homeForm.$.setPasswordField.$;
                    await this.props.authContainer.createNewVault(password);
                    this.props.homeContainer.homeForm.$.setPasswordField.reset();
                    this.props.homeContainer.homeForm.$.confirmPasswordField.reset();
                  }}
                >
                  Create Vault
                </Button>
              </FormControl>
            </form>
          </Grid>
        </Grid>
      </div>
    );
  }

  renderAccountLists() {
    return (
      <div>
        <Grid
          container
          spacing={4}
          direction={'column'}
          justify={'flex-start'}
          alignItems={'center'}
        >
          {this.props.authContainer.userAccounts.length > 0 ? (
            <Grid item className={this.props.classes.alignCenter}>
              <img src={logo} alt="logo" width={120} />
              {this.props.authContainer.userAccounts.length > 1 ? (
                <Typography variant={'h6'} align={'center'}>
                  You have {this.props.authContainer.userAccounts.length}{' '}
                  account keys
                </Typography>
              ) : (
                <Typography variant={'h6'} align={'center'}>
                  You have {this.props.authContainer.userAccounts.length}{' '}
                  account key
                </Typography>
              )}
              {this.props.authContainer.selectedUserAccount && (
                <Typography variant={'h6'} align={'center'}>
                  Active key:{' '}
                  <span style={{ wordBreak: 'break-all' }}>
                    {this.props.authContainer.selectedUserAccount.alias}
                  </span>
                </Typography>
              )}
            </Grid>
          ) : (
            <Grid item className={this.props.classes.alignCenter}>
              <AddCircleIcon style={{ color: '#e24c2c', fontSize: '4rem' }} />
              <Typography variant={'h5'} align={'center'}>
                Please create an account to get started
              </Typography>
            </Grid>
          )}

          <Grid item>
            <FormControl fullWidth className={this.props.classes.margin}>
              <Button
                aria-label="This will open a new window to import a key to your vault"
                component={Link}
                variant="contained"
                color="primary"
                onClick={() =>
                  this.props.popupManager.openPopup('importAccount')
                }
                to={Pages.ImportAccount}
                style={{
                  backgroundColor: '#fff',
                  color: 'var(--cspr-dark-blue)'
                }}
              >
                Import Account
              </Button>
            </FormControl>
            <FormControl fullWidth className={this.props.classes.margin}>
              <Button
                aria-label="This will open a form to create an account - focus will be given to the input field for key name"
                component={Link}
                variant="contained"
                color="primary"
                to={Pages.CreateAccount}
                style={{
                  backgroundColor: '#fff',
                  color: 'var(--cspr-dark-blue)'
                }}
              >
                Create Account
              </Button>
            </FormControl>
          </Grid>
        </Grid>
      </div>
    );
  }

  resetVaultOnClick() {
    confirm(
      <div className="text-danger">Danger!</div>,
      'Resetting vault will delete all imported accounts.'
    ).then(() => {
      this.props.authContainer.resetVault();
      this.props.errors.dismissLast();
      this.props.homeContainer.homeForm.$.setPasswordField.reset();
    });
  }

  renderUnlock() {
    return (
      <div>
        <Grid
          container
          spacing={4}
          direction={'column'}
          justify={'flex-start'}
          alignItems={'center'}
        >
          <Grid item className={this.props.classes.alignCenter}>
            <img src={logo} alt="logo" width={120} />
            <Typography variant={'h4'} align={'center'}>
              Unlock Vault
            </Typography>
          </Grid>

          <Grid item container>
            <form style={{ textAlign: 'center' }}>
              <FormControl fullWidth>
                <TextFieldWithFormState
                  aria-label="Enter password for vault"
                  autoFocus={true}
                  fieldState={
                    this.props.homeContainer.homeForm.$.setPasswordField
                  }
                  required
                  id={'unlock-password'}
                  label={'Password'}
                  type={'password'}
                />
              </FormControl>
              <FormControl fullWidth className={this.props.classes.margin}>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  classes={{
                    root: this.props.classes.unlockButton,
                    disabled: this.props.classes.disabled
                  }}
                  disabled={this.props.homeContainer.submitDisabled}
                  onClick={async () => {
                    let password =
                      this.props.homeContainer.homeForm.$.setPasswordField.$;
                    try {
                      await this.props.authContainer.unlock(password);
                      this.props.homeContainer.homeForm.$.setPasswordField.reset();
                      this.props.errors.dismissLast();
                    } catch (e) {
                      this.props.homeContainer.homeForm.$.setPasswordField.setError(
                        e.message
                      );
                    }
                  }}
                >
                  Unlock
                </Button>
              </FormControl>
              <div className="reset-vault">
                <a
                  aria-label="Reset vault - this will open a confirmation before erasing keys"
                  href="#"
                  className="text-danger"
                  id="reset-link"
                  onClick={() => this.resetVaultOnClick()}
                >
                  Reset Vault?
                </a>
              </div>
            </form>
          </Grid>
        </Grid>
      </div>
    );
  }

  render() {
    if (this.props.authContainer.hasCreatedVault) {
      if (this.props.authContainer.isUnLocked) {
        if (
          !this.props.connectionContainer.connectionStatus &&
          this.props.connectionContainer.connectionRequested
        ) {
          // Not connected and there is a request to connect
          return <Redirect to={Pages.ConnectSigner} />;
        } else {
          if (this.props.authContainer.unsignedDeploys.length > 0) {
            return <Redirect to={Pages.SignMessage} />;
          } else {
            return this.renderAccountLists();
          }
        }
      } else {
        return this.renderUnlock();
      }
    } else {
      return this.renderCreateNewVault();
    }
  }
}

export default withStyles(styles, { withTheme: true })(withRouter(Home));
