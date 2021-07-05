import { Typography, Box, Grid, Button } from '@material-ui/core';
import { observer } from 'mobx-react';
import React from 'react';
import { Redirect, RouteComponentProps, withRouter } from 'react-router-dom';
import { browser } from 'webextension-polyfill-ts';
import ConnectSignerContainer from '../container/ConnectSignerContainer';
import Pages from './Pages';
import confirmConnect from './ConfirmConnect';

interface Props extends RouteComponentProps {
  connectSignerContainer: ConnectSignerContainer;
}

@observer
class ConnectSignerPage extends React.Component<Props, {}> {
  async componentDidMount() {
    let w = await browser.windows.getCurrent();
    if (w.type === 'popup') {
      window.addEventListener('beforeunload', e => {
        this.props.connectSignerContainer.cancel();
      });
    }
  }

  render() {
    if (!this.props.connectSignerContainer.connectionStatus) {
      return (
        <div style={{ flexGrow: 1 }}>
          <Typography
            align={'center'}
            variant={'h5'}
            style={{ marginBottom: '1rem' }}
          >
            Connection Request
          </Typography>
          <Typography align={'center'} variant={'body1'}>
            Would you like to allow{' '}
            <b>{this.props.connectSignerContainer.currentTab?.url}</b> to
            connect?
          </Typography>
          <Box mt={8}>
            <Grid
              container
              spacing={4}
              justify={'center'}
              alignItems={'center'}
            >
              <Grid item>
                <Button
                  variant="contained"
                  color="secondary"
                  onClick={() => {
                    this.props.connectSignerContainer.cancel();
                  }}
                >
                  Cancel
                </Button>
              </Grid>
              <Grid item>
                <Button
                  onClick={() => {
                    confirmConnect().then(() =>
                      this.props.connectSignerContainer.connectToSite()
                    );
                  }}
                  variant="contained"
                  color="primary"
                  style={{
                    backgroundColor: 'var(--cspr-dark-blue)'
                  }}
                >
                  Connect
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

export default withRouter(ConnectSignerPage);
