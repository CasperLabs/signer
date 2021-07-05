import { FieldState, FormState } from 'formstate';
import {
  strongPassword,
  valueRequired,
  valuesMatch
} from '../../lib/FormValidator';
import { computed } from 'mobx';

export class HomeContainer {
  homeForm = new FormState({
    // The text field for storing user input password, used in 'Create Vault' and 'Unlock Vault' page.
    setPasswordField: new FieldState<string>('').validators(
      valueRequired,
      strongPassword
    ),
    confirmPasswordField: new FieldState<string>('').validators(valueRequired),
    unlockPasswordField: new FieldState<string>('').validators(valueRequired)
  })
    .compose()
    .validators($ =>
      valuesMatch($.setPasswordField.$, $.confirmPasswordField.$)
    );

  @computed
  get unlockDisabled(): boolean {
    return (
      !this.homeForm.$.unlockPasswordField.hasBeenValidated ||
      (this.homeForm.$.unlockPasswordField.hasBeenValidated &&
        this.homeForm.$.unlockPasswordField.hasError)
    );
  }

  @computed
  get createVaultDisabled(): boolean {
    return (
      !this.homeForm.$.setPasswordField.hasBeenValidated ||
      (this.homeForm.$.setPasswordField.hasBeenValidated &&
        this.homeForm.$.setPasswordField.hasError) ||
      !this.homeForm.$.confirmPasswordField.hasBeenValidated ||
      (this.homeForm.$.confirmPasswordField.hasBeenValidated &&
        this.homeForm.$.confirmPasswordField.hasError) ||
      !(
        this.homeForm.$.setPasswordField.value ===
        this.homeForm.$.confirmPasswordField.value
      )
    );
  }
}
