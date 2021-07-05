import React from 'react';
import {
  confirmable,
  createConfirmation,
  ReactConfirmProps
} from 'react-confirm';
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  FormControlLabel
} from '@material-ui/core';
import { TextFieldWithFormState } from '../components/Forms';
import AccountManager from '../container/AccountManager';
import { ErrorContainer } from '../container/ErrorContainer';
import { BackgroundManager } from '../BackgroundManager';
import { AppState } from '../../lib/MemStore';

interface Props extends ReactConfirmProps {
  proceedLabel: string;
  cancelLabel: string;
  title: string | React.ReactElement;
  options: {
    requirePassword: boolean;
    requireCheckbox: boolean;
    checkboxText: string;
    unmountAfter: number;
  };
}

class Confirmation extends React.Component<Props, { boxChecked: boolean }> {
  private errors = new ErrorContainer();
  private appState = new AppState();
  private background = new BackgroundManager(this.appState, this.errors);
  private accountManager = new AccountManager(
    this.errors,
    this.background,
    this.appState
  );

  constructor(props: Props) {
    super(props);
    this.state = { boxChecked: false };
  }

  handleCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ boxChecked: event.target.checked });
  };

  render() {
    return (
      <Dialog
        open={this.props.show}
        onClose={this.props.dismiss}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">{this.props.title}</DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            {this.props.confirmation}
          </DialogContentText>
          {this.props.options.requirePassword && (
            <FormControl>
              <TextFieldWithFormState
                autoFocus={true}
                fieldState={
                  this.accountManager.confirmPasswordForm.$.confirmPasswordField
                }
                required
                label={'Password'}
                type={'password'}
              />
            </FormControl>
          )}
          {this.props.options.requireCheckbox && (
            <FormControlLabel
              control={
                <Checkbox
                  style={{ alignSelf: 'flex-start' }}
                  checked={this.state.boxChecked}
                  onChange={this.handleCheckboxChange}
                />
              }
              label={this.props.options.checkboxText}
              // Needs styling - the font's a bit big
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              this.props.cancel();
            }}
            color="secondary"
          >
            {this.props.cancelLabel}
          </Button>
          {this.props.options.requirePassword ? (
            <FormControl>
              <Button
                type="submit"
                // TODO: Disable doesn't work - doesn't enable when field is non-null.
                // disabled={this.accountManager.confirmPasswordDisabled}
                onClick={async () => {
                  let givenPassword =
                    this.accountManager.confirmPasswordForm.$
                      .confirmPasswordField.$;
                  try {
                    await this.accountManager.confirmPassword(givenPassword);
                    this.accountManager.confirmPasswordForm.$.confirmPasswordField.reset();
                    this.errors.dismissLast();
                    this.props.proceed();
                  } catch (e) {
                    this.accountManager.confirmPasswordForm.$.confirmPasswordField.setError(
                      e.message
                    );
                  }
                }}
                color="primary"
              >
                {this.props.proceedLabel}
              </Button>
            </FormControl>
          ) : (
            <Button
              disabled={
                this.props.options.requireCheckbox
                  ? !this.state.boxChecked
                  : false
              }
              onClick={() => {
                this.props.proceed();
              }}
              color="primary"
            >
              {this.props.proceedLabel}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    );
  }
}

export function confirm(
  title: string | React.ReactElement,
  confirmation: string | React.ReactElement,
  proceedLabel = 'OK',
  cancelLabel = 'cancel',
  options: {
    requirePassword?: boolean;
    requireCheckbox?: boolean;
    checkboxText?: string;
    unmountAfter?: number;
  } = {
    requirePassword: false,
    requireCheckbox: false,
    checkboxText: '',
    unmountAfter: 10000
  }
) {
  console.log(options.unmountAfter);
  return createConfirmation(
    confirmable(Confirmation),
    options.unmountAfter
  )({
    title,
    confirmation,
    proceedLabel,
    cancelLabel,
    options
  });
}
