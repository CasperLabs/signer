import { observer } from 'mobx-react';
import React from 'react';
import AccountManager from '../container/AccountManager';
import PopupManager from '../../background/PopupManager';
import { RouteComponentProps, withRouter } from 'react-router';
import { observable } from 'mobx';
import {
  CreateAccountFormData,
  ImportAccountFormData
} from '../container/ImportAccountContainer';
import ErrorContainer from '../container/ErrorContainer';
import {
  Button,
  Checkbox,
  createStyles,
  Theme,
  Typography,
  WithStyles,
  FormControlLabel,
  FormControl,
  Box,
  InputLabel,
  Popover,
  IconButton
} from '@material-ui/core';
import HelpIcon from '@material-ui/icons/Help';
import { SelectFieldWithFormState, TextFieldWithFormState } from './Forms';
import withStyles from '@material-ui/core/styles/withStyles';
import { decodeBase16, decodeBase64, Keys } from 'casper-client-sdk';
import { KeyPairWithAlias } from '../../@types/models';
import Pages from './Pages';

const styles = (theme: Theme) =>
  createStyles({
    root: {
      '& .MuiTextField-root': {
        marginTop: theme.spacing(2)
      }
    },
    importButton: {
      marginTop: theme.spacing(8)
    }
  });

interface Props extends RouteComponentProps, WithStyles<typeof styles> {
  authContainer: AccountManager;
  errors: ErrorContainer;
  action: 'Import' | 'Create';
}

@observer
class AccountPage extends React.Component<
  Props,
  { keyDownloadEnabled: boolean; algoAnchorEl: HTMLButtonElement | null }
> {
  @observable accountForm: ImportAccountFormData | CreateAccountFormData;

  private popupManager: PopupManager;

  constructor(props: Props) {
    super(props);
    if (props.action === 'Import') {
      this.accountForm = new ImportAccountFormData(props.errors);
    } else {
      this.accountForm = new CreateAccountFormData(props.errors);
    }
    this.state = {
      keyDownloadEnabled: false,
      algoAnchorEl: null
    };
    this.popupManager = new PopupManager();
  }

  async onCreateAccount() {
    const formData = this.accountForm as CreateAccountFormData;
    if (formData.submitDisabled) {
      return;
    }

    const names = this.props.authContainer.userAccounts.map(
      account => account.alias
    );
    if (names.includes(formData.name.$)) {
      return this.props.errors.capture(
        Promise.reject(
          new Error(`An account with name '${formData.name.$}' already exists.`)
        )
      );
    }

    let keyPair: KeyPairWithAlias;
    // TODO: extend support to Secp256k1
    switch (formData.algorithm.$) {
      case 'ed25519': {
        keyPair = {
          alias: formData.name.$,
          KeyPair: Keys.Ed25519.parseKeyPair(
            decodeBase16(formData.publicKey.$.substring(2)),
            decodeBase64(formData.secretKeyBase64.value)
          )
        };
        break;
      }
      case 'secp256k1': {
        keyPair = {
          alias: formData.name.$,
          KeyPair: Keys.Secp256K1.parseKeyPair(
            decodeBase16(formData.publicKey.$.substring(2)),
            decodeBase64(formData.secretKeyBase64.value),
            'raw'
          )
        };
        break;
      }
      default: {
        throw new Error('Invalid algorithm selected');
      }
    }

    if (this.state.keyDownloadEnabled) {
      this.props.authContainer.downloadPemFiles(keyPair);
    }

    await this._onSubmit();
  }

  onImportAccount() {
    if (this.accountForm.submitDisabled) {
      return;
    }
    this._onSubmit();
  }

  async _onSubmit() {
    await this.props.authContainer.importUserAccount(
      this.accountForm.name.$,
      this.accountForm.secretKeyBase64.value,
      this.accountForm.algorithm.$
    );
    this.props.history.push(Pages.Home);
    this.props.history.replace(Pages.Home);
  }

  renderImportForm() {
    const showAlgoHelp = (event: React.MouseEvent<HTMLButtonElement>) => {
      this.setState({ algoAnchorEl: event.currentTarget });
    };
    const helpOpen = Boolean(showAlgoHelp);
    const helpId = helpOpen ? 'algo-helper' : undefined;
    const helpClose = () => {
      this.setState({ algoAnchorEl: null });
    };

    const form = this.accountForm as ImportAccountFormData;
    return (
      <form className={this.props.classes.root}>
        <FormControl>
          <Typography id="continuous-slider" variant="h6" gutterBottom>
            Import from Secret Key File
          </Typography>
          <Box
            display={'flex'}
            flexDirection={'row'}
            alignItems={'center'}
            m={1}
          >
            <Button
              id={'private-key-uploader'}
              variant="contained"
              style={{
                backgroundColor: 'var(--cspr-dark-blue)',
                color: 'white'
              }}
              component="label"
            >
              Upload
              <input
                type="file"
                style={{ display: 'none' }}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  form.handleFileSelect(e)
                }
              />
            </Button>
            <Box ml={1}>
              <Typography component={'span'}>
                <Box fontSize={12}>
                  {form.file ? form.file.name : 'No file selected'}
                </Box>
              </Typography>
            </Box>
          </Box>
        </FormControl>
        <Box>
          <FormControl style={{ width: '80%' }}>
            <InputLabel id="algo-select-lbl">Algorithm</InputLabel>
            <SelectFieldWithFormState
              fullWidth
              labelId="algo-select-lbl"
              fieldState={this.accountForm.algorithm}
              selectItems={[
                { value: 'ed25519', text: 'ED25519' },
                { value: 'secp256k1', text: 'SECP256k1' }
              ]}
            />
          </FormControl>
          <IconButton onClick={showAlgoHelp} style={{ float: 'right' }}>
            <HelpIcon />
          </IconButton>
          {this.state.algoAnchorEl && (
            <Popover
              id={helpId}
              open={helpOpen}
              anchorEl={this.state.algoAnchorEl}
              onClose={helpClose}
              anchorOrigin={{
                vertical: 'top',
                horizontal: 'right'
              }}
              transformOrigin={{
                vertical: 'bottom',
                horizontal: 'right'
              }}
            >
              <Typography
                component={'summary'}
                style={{
                  padding: '1.4em',
                  backgroundColor: 'var(--cspr-dark-blue)',
                  color: 'white'
                }}
              >
                <b>Which algorithm?</b>
                <br />
                Open your <code>public_key_hex</code> file which should be in
                the same location as the secret key file.
                <br />
                If the key starts with:
                <ul>
                  <li>01: ED25519</li>
                  <li>02: SECP256k1</li>
                </ul>
              </Typography>
            </Popover>
          )}
        </Box>
        <TextFieldWithFormState
          fullWidth
          label="Name"
          placeholder="Human Readable Alias"
          id="import-name"
          fieldState={this.accountForm.name}
        />
        <FormControl fullWidth className={this.props.classes.importButton}>
          <Button
            type="submit"
            disabled={this.accountForm.submitDisabled}
            color="primary"
            variant={'contained'}
            onClick={() => {
              this.onImportAccount();
            }}
          >
            Import
          </Button>
        </FormControl>
      </form>
    );
  }

  renderCreateForm() {
    const formData = this.accountForm as CreateAccountFormData;
    const toggleDownloadKey = (event: React.ChangeEvent<HTMLInputElement>) => {
      this.setState({
        ...this.state,
        keyDownloadEnabled: event.target.checked
      });
    };
    return (
      <form className={this.props.classes.root}>
        <Typography variant="h6" style={{ marginTop: '-1em' }}>
          Create Account
        </Typography>
        <TextFieldWithFormState
          aria-label="Input for setting name of key"
          autoFocus
          fullWidth
          label="Name"
          placeholder="Human Readable Alias"
          id="import-name"
          fieldState={this.accountForm.name}
        />
        {/* 
          TODO: Uncomment the below FormControl and delete the subsequent
          TextFieldWithFormState when SECP256k1 generation is fixed
        */}
        <FormControl fullWidth>
          <InputLabel id="algo-select-lbl">Algorithm</InputLabel>
          <SelectFieldWithFormState
            fullWidth
            labelId="algo-select-lbl"
            fieldState={this.accountForm.algorithm}
            selectItems={[
              { value: 'ed25519', text: 'ED25519' },
              { value: 'secp256k1', text: 'SECP256k1' }
            ]}
          />
        </FormControl>
        {/* <TextFieldWithFormState
          fullWidth
          InputProps={{ readOnly: true, disabled: true }}
          label="Algorithm"
          value={formData.algorithm.$ ? formData.algorithm.$ : ''}
        /> */}
        <TextFieldWithFormState
          fullWidth
          InputProps={{ readOnly: true, disabled: true }}
          label="Public Key"
          id="create-public-key"
          value={formData.publicKey.$ ? formData.publicKey.$ : ''}
        />
        <TextFieldWithFormState
          fullWidth
          InputProps={{ readOnly: true, disabled: true }}
          label="Secret Key (Base64)"
          placeholder="Base64 encoded Ed25519 secret key"
          id="create-private-key"
          value={formData.secretKeyBase64.$ ? formData.secretKeyBase64.$ : ''}
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={this.state.keyDownloadEnabled}
              onChange={toggleDownloadKey}
              name="keyDownloadToggle"
            />
          }
          label="Download Key"
        />
        <FormControl fullWidth margin={'normal'}>
          <Button
            type="submit"
            className="mt-5"
            disabled={this.accountForm.submitDisabled}
            color="primary"
            variant="contained"
            onClick={() => {
              this.onCreateAccount();
            }}
          >
            Create
          </Button>
        </FormControl>
      </form>
    );
  }

  render() {
    return (
      <div>
        <div className="mt-5 mb-4">
          {this.accountForm instanceof CreateAccountFormData
            ? this.renderCreateForm()
            : this.renderImportForm()}
        </div>
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(withRouter(AccountPage));
