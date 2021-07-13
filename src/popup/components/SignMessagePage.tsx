import { observer } from 'mobx-react';
import React from 'react';
import { Redirect, RouteComponentProps, withRouter } from 'react-router';
import SignMessageContainer from '../container/SignMessageContainer';
import Pages from './Pages';
import { browser } from 'webextension-polyfill-ts';
import AccountManager from '../container/AccountManager';
import { withStyles } from '@material-ui/core/styles';
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Tooltip
} from '@material-ui/core';
import Typography from '@material-ui/core/Typography';
import Grid from '@material-ui/core/Grid';
import Box from '@material-ui/core/Box';
import { deployWithID } from '../../background/SignMessageManager';
import { truncateString, numberWithSpaces } from 'background/utils';

const styles = () => ({
  tooltip: {
    width: '260px',
    margin: '10px 0 0 0'
  }
});

interface Props extends RouteComponentProps {
  signMessageContainer: SignMessageContainer;
  authContainer: AccountManager;
  classes: Record<keyof ReturnType<typeof styles>, string>;
}

@observer
class SignMessagePage extends React.Component<
  Props,
  { rows: any; deployToSign: deployWithID | null }
> {
  constructor(props: Props) {
    super(props);
    this.state = {
      rows: [],
      deployToSign: this.props.signMessageContainer.deployToSign
    };
  }

  async componentDidMount() {
    let w = await browser.windows.getCurrent();
    if (w.type === 'popup') {
      window.addEventListener('beforeunload', e => {
        this.props.signMessageContainer.cancel(this.state.deployToSign?.id!);
      });
    }
    if (this.state.deployToSign) {
      this.generateDeployInfo(this.state.deployToSign);
    }
  }

  createRow(key: string, value: any, title?: any) {
    return { key, value, title };
  }

  async generateDeployInfo(deployToSign: deployWithID) {
    let deployData = await this.props.signMessageContainer.parseDeployData(
      deployToSign.id
    );
    let baseRows = [
      this.createRow(
        'Signing Key',
        truncateString(deployData.signingKey, 6, 6),
        deployData.signingKey
      ),
      this.createRow(
        'Account',
        truncateString(deployData.account, 6, 6),
        deployData.account
      ),
      this.createRow(
        'Hash',
        truncateString(deployData.deployHash, 6, 6),
        deployData.deployHash
      ),
      this.createRow('Timestamp', deployData.timestamp),
      this.createRow('Chain Name', deployData.chainName),
      this.createRow('Gas Price', deployData.gasPrice),
      // TODO: Payment data needs to be formatted in the background before being sent to UI here.
      this.createRow('Payment', deployData.payment),
      this.createRow('Deploy Type', deployData.deployType)
    ];
    if (deployData.deployType === 'Transfer') {
      console.log({ recipient: deployData.recipient });
      this.setState({
        rows: [
          ...baseRows,
          this.createRow(
            'Recipient (Key)',
            truncateString(deployData.recipient!, 6, 6),
            deployData.recipient
          ),
          this.createRow(
            'Target',
            truncateString(deployData.target!, 6, 6),
            deployData.target
          ),
          this.createRow(
            'Amount',
            `${numberWithSpaces(deployData.amount)} motes`
          ),
          this.createRow('Transfer ID', deployData.id)
        ]
      });
    } else if (deployData.deployType === 'Contract Deployment') {
      this.setState({
        rows: [
          ...baseRows,
          this.createRow(
            'Validator',
            truncateString(deployData.validator!, 6, 6),
            deployData.validator
          ),
          this.createRow(
            'Delegator',
            truncateString(deployData.delegator!, 6, 6),
            deployData.delegator
          )
        ]
      });
    } else {
      this.setState({ rows: baseRows });
    }
  }

  render() {
    if (this.state.deployToSign) {
      const deployId = this.props.signMessageContainer.deployToSign?.id;
      return (
        <div style={{ flexGrow: 1, marginTop: '-30px' }}>
          <Typography align={'center'} variant={'h6'}>
            Signature Request
          </Typography>
          <TableContainer>
            <Table style={{ maxWidth: '100%' }}>
              <TableBody>
                {this.state.rows.map((row: any) => (
                  <Tooltip
                    key={row.key}
                    title={row.title ? row.title : ''}
                    classes={{ tooltip: this.props.classes.tooltip }}
                    placement="top"
                  >
                    <TableRow key={row.key}>
                      <TableCell
                        component="th"
                        scope="row"
                        style={{ fontWeight: 'bold' }}
                      >
                        {row.key}
                      </TableCell>
                      <TableCell align="right">{row.value}</TableCell>
                    </TableRow>
                  </Tooltip>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Box mt={8}>
            <Grid
              container
              style={{ marginTop: '-50px' }}
              spacing={4}
              justify={'center'}
              alignItems={'center'}
            >
              <Grid item>
                <Button
                  variant="contained"
                  color="secondary"
                  onClick={() => {
                    this.props.signMessageContainer.cancel(deployId!);
                  }}
                >
                  Cancel
                </Button>
              </Grid>
              <Grid item>
                <Button
                  onClick={() =>
                    this.props.signMessageContainer
                      .signDeploy(deployId!)
                      .then(() => {
                        window.close();
                      })
                  }
                  variant="contained"
                  color="primary"
                  style={{
                    backgroundColor: 'var(--cspr-dark-blue)'
                  }}
                >
                  Sign
                </Button>
              </Grid>
            </Grid>
          </Box>
        </div>
      );
    } else {
      return <Redirect to={Pages.Home} />;
    }
  }
}

export default withStyles(styles)(withRouter(SignMessagePage));
