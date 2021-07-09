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

// TODO: Move it to helper functions
const numberWithSpaces = (num: number) =>
  num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

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

  truncateString(
    longString: string,
    startChunk: number,
    endChunk: number
  ): string {
    return (
      longString.substring(0, startChunk) +
      '...' +
      longString.substring(longString.length - endChunk)
    );
  }

  async generateDeployInfo(deployToSign: deployWithID) {
    let deployData = await this.props.signMessageContainer.parseDeployData(
      deployToSign.id
    );
    let baseRows = [
      this.createRow(
        'Signing Key',
        this.truncateString(deployData.signingKey, 6, 6),
        deployData.signingKey
      ),
      this.createRow(
        'Account',
        this.truncateString(deployData.account, 6, 6),
        deployData.account
      ),
      this.createRow(
        'Hash',
        this.truncateString(deployData.deployHash, 6, 6),
        deployData.deployHash
      ),
      this.createRow('Timestamp', deployData.timestamp),
      this.createRow('Chain Name', deployData.chainName),
      this.createRow('Gas Price', deployData.gasPrice),
      this.createRow('Deploy Type', deployData.deployType),
      this.createRow('Amount', `${numberWithSpaces(deployData.amount)} motes`)
    ];
    if (deployData.deployType === 'Transfer') {
      this.setState({
        rows: [
          ...baseRows,
          this.createRow(
            'Target',
            this.truncateString(deployData.target!, 6, 6),
            deployData.target
          ),
          this.createRow('Transfer ID', deployData.id)
        ]
      });
    } else if (deployData.deployType === 'Contract Deployment') {
      let deployArgsRows = [];

      for (let [key, value] of Object.entries(deployData.deployArgs)) {
        key = key.charAt(0).toUpperCase() + key.slice(1);
        key = key.replace('_', ' ');
        if (value.length > 20) {
          value = this.truncateString(value, 6, 6);
        }
        deployArgsRows.push(this.createRow(key, value));
      }

      this.setState({
        rows: [
          ...baseRows,
          this.createRow('Contract Arguments', ''),
          ...deployArgsRows
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
