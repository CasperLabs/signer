import React from 'react';
import { RouteComponentProps, withRouter } from 'react-router-dom';
import {
  List,
  ListItem,
  ListItemText,
  IconButton,
  ListItemSecondaryAction,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Input,
  Snackbar,
  ListSubheader,
  Typography,
  Tooltip
} from '@material-ui/core';
import RootRef from '@material-ui/core/RootRef';
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult
} from 'react-beautiful-dnd';
import DeleteIcon from '@material-ui/icons/Delete';
import EditIcon from '@material-ui/icons/Edit';
import VpnKeyIcon from '@material-ui/icons/VpnKey';
import FilterNoneIcon from '@material-ui/icons/FilterNone'; // Used for Copy
import AccountManager from '../container/AccountManager';
import ConnectSignerContainer from '../container/ConnectSignerContainer';
import { observer, Observer } from 'mobx-react';
import Dialog from '@material-ui/core/Dialog';
import { confirm } from './Confirmation';
import copy from 'copy-to-clipboard';
import { KeyPairWithAlias } from '../../@types/models';
import { CLPublicKey } from 'casper-js-sdk';
import { GetApp } from '@material-ui/icons';

const getItemStyle = (isDragging: boolean, draggableStyle: any) => ({
  // styles we need to apply on draggables
  ...draggableStyle,

  ...(isDragging && {
    background: 'rgb(235,235,235)'
  })
});

interface Props extends RouteComponentProps {
  authContainer: AccountManager;
  connectionContainer: ConnectSignerContainer;
}

interface State {
  openDialog: boolean;
  openKeyDialog: boolean;
  selectedAccount: KeyPairWithAlias | null;
  alias: string | null;
  publicKey: CLPublicKey | null;
  publicKeyHex: string | null;
  accountHash: string | null;
  copyStatus: boolean;
}

@observer
class AccountManagementPage extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      openDialog: false,
      openKeyDialog: false,
      selectedAccount: null,
      alias: null,
      publicKey: null,
      publicKeyHex: null,
      accountHash: null,
      copyStatus: false
    };
  }

  handleClickOpen = (account: KeyPairWithAlias) => {
    this.setState({
      openDialog: true,
      selectedAccount: account,
      alias: account.alias
    });
  };

  handleViewKey = async (accountName: string) => {
    let hexKey = await this.props.authContainer.getPublicKeyHex(accountName);
    let hash = await this.props.authContainer.getAccountHash(accountName);
    this.setState({
      alias: accountName,
      publicKeyHex: hexKey,
      accountHash: hash,
      openKeyDialog: true
    });
  };

  handleDownloadKeys = async (alias: string) => {
    return await this.props.authContainer.downloadPemFiles(alias);
  };

  handleCopyMessage = (event?: React.SyntheticEvent, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    this.setState({ copyStatus: false });
  };

  handleClose = () => {
    this.setState({
      openDialog: false,
      openKeyDialog: false,
      selectedAccount: null
    });
  };

  handleUpdateName = () => {
    let account = this.state.selectedAccount;
    let alias = this.state.alias;
    if (account && alias) {
      this.props.authContainer.renameUserAccount(account.alias, alias);
      this.props.authContainer.switchToAccount(alias);
      this.handleClose();
    }
  };

  onDragEnd = (result: DropResult) => {
    // dropped outside the list
    if (!result.destination) {
      return;
    }

    this.props.authContainer.reorderAccount(
      result.source.index,
      result.destination.index
    );
  };

  handleClickRemove = (name: string) => {
    confirm(
      <div className="text-danger">Remove account</div>,
      <span>
        This account will be permanently deleted. Confirm password to remove
        account: <b>{name}</b>
      </span>,
      'Remove',
      'Cancel',
      { requirePassword: true }
    ).then(() => this.props.authContainer.removeUserAccount(name));
  };

  render() {
    return (
      <React.Fragment>
        <DragDropContext onDragEnd={result => this.onDragEnd(result)}>
          <Droppable droppableId="droppable">
            {(provided, snapshot) => (
              <Observer>
                {() => (
                  <RootRef rootRef={provided.innerRef}>
                    <List>
                      {this.props.authContainer.userAccounts.map(
                        (item, index) => (
                          <Draggable
                            key={item.alias}
                            draggableId={item.alias}
                            index={index}
                          >
                            {(provided, snapshot) => (
                              <ListItem
                                innerRef={provided.innerRef}
                                ContainerProps={{
                                  ...provided.draggableProps,
                                  ...provided.dragHandleProps,
                                  style: getItemStyle(
                                    snapshot.isDragging,
                                    provided.draggableProps.style
                                  )
                                }}
                              >
                                <ListItemText primary={item.alias} />
                                <ListItemSecondaryAction>
                                  <Tooltip title="Edit">
                                    <IconButton
                                      aria-label="Button will open a dialog to rename key"
                                      edge={'end'}
                                      onClick={() => {
                                        this.handleClickOpen(item);
                                      }}
                                    >
                                      <EditIcon />
                                    </IconButton>
                                  </Tooltip>
                                  {this.props.authContainer.userAccounts
                                    .length > 1 ? (
                                    <Tooltip title="Delete">
                                      <IconButton
                                        edge={'end'}
                                        onClick={() => {
                                          this.handleClickRemove(item.alias);
                                        }}
                                      >
                                        <DeleteIcon />
                                      </IconButton>
                                    </Tooltip>
                                  ) : (
                                    // span is required for tooltip to work on disabled button
                                    <Tooltip title="Can't delete only account">
                                      <span>
                                        <IconButton edge={'end'} disabled>
                                          <DeleteIcon />
                                        </IconButton>
                                      </span>
                                    </Tooltip>
                                  )}
                                  <Tooltip title="View">
                                    <IconButton
                                      edge={'end'}
                                      onClick={() => {
                                        this.handleViewKey(item.alias);
                                      }}
                                    >
                                      <VpnKeyIcon />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Download">
                                    <IconButton
                                      edge={'end'}
                                      onClick={() => {
                                        this.handleDownloadKeys(item.alias);
                                      }}
                                    >
                                      <GetApp />
                                    </IconButton>
                                  </Tooltip>
                                </ListItemSecondaryAction>
                              </ListItem>
                            )}
                          </Draggable>
                        )
                      )}
                      {provided.placeholder}
                    </List>
                  </RootRef>
                )}
              </Observer>
            )}
          </Droppable>
        </DragDropContext>
        <Dialog
          open={this.state.openDialog}
          onClose={this.handleClose}
          aria-label="Form to rename account - focus will be given to name input field"
          aria-labelledby="form-dialog-title"
        >
          <DialogTitle id="form-dialog-title">Rename</DialogTitle>
          <DialogContent>
            <Input
              autoFocus
              margin="dense"
              id="name"
              type="text"
              fullWidth
              value={this.state.alias}
              onChange={e => {
                this.setState({ alias: e.target.value });
              }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={this.handleClose} color="primary">
              Cancel
            </Button>
            <Button onClick={this.handleUpdateName} color="primary">
              Update
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          fullScreen
          open={this.state.openKeyDialog}
          onClose={this.handleClose}
          aria-labelledby="form-dialog-title"
        >
          <DialogTitle id="form-dialog-title">Account Details</DialogTitle>
          <DialogContent>
            <List>
              <ListSubheader>
                <Typography variant={'h6'}>{this.state.alias}</Typography>
              </ListSubheader>
              <ListItem>
                <IconButton
                  edge={'start'}
                  onClick={() => {
                    copy(this.state.publicKeyHex!);
                    this.setState({ copyStatus: true });
                  }}
                >
                  <FilterNoneIcon />
                </IconButton>
                <ListItemText
                  primary={`Public Key: ${this.state.publicKeyHex}`}
                  style={{ overflowWrap: 'break-word' }}
                />
              </ListItem>
              <ListItem>
                <IconButton
                  edge={'start'}
                  onClick={() => {
                    copy(this.state.accountHash!);
                    this.setState({ copyStatus: true });
                  }}
                >
                  <FilterNoneIcon />
                </IconButton>
                <ListItemText
                  primary={`Account Hash: ${this.state.accountHash}`}
                  style={{ overflowWrap: 'break-word' }}
                />
              </ListItem>
            </List>
            <Snackbar
              open={this.state.copyStatus}
              message="Copied!"
              autoHideDuration={1500}
              onClose={this.handleCopyMessage}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={this.handleClose} color="primary">
              Close
            </Button>
          </DialogActions>
        </Dialog>
      </React.Fragment>
    );
  }
}
export default withRouter(AccountManagementPage);
