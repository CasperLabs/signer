import { FieldState } from 'formstate';
import {
  fieldSubmittable,
  valueRequired,
  isAlgorithm,
  humanReadable,
  minNameLength
} from '../../lib/FormValidator';
import { action, computed, observable } from 'mobx';
import { encodeBase64 } from 'tweetnacl-util';
import ErrorContainer from './ErrorContainer';
import { decodeBase16, Keys } from 'casper-js-sdk';
import ASN1 from '@lapo/asn1js';
import Base64 from '@lapo/asn1js/base64';
import Hex from '@lapo/asn1js/hex';
export interface SubmittableFormData {
  submitDisabled: boolean;
  resetFields: () => void;
}

export class ImportAccountFormData implements SubmittableFormData {
  secretKeyBase64: FieldState<string> = new FieldState<string>('').validators(
    valueRequired
  );
  algorithm: FieldState<string> = new FieldState<string>('').validators(
    valueRequired,
    isAlgorithm
  );
  name: FieldState<string> = new FieldState<string>('').validators(
    valueRequired,
    minNameLength,
    humanReadable
  );
  reHex = /^\s*(?:[0-9A-Fa-f][0-9A-Fa-f]\s*)+$/;
  @observable file: File | null = null;

  private parseAlgorithm(val: any) {
    let decoded;
    try {
      const der: Uint8Array = this.reHex.test(val)
        ? Hex.decode(val)
        : Base64.unarmor(val);
      decoded = ASN1.decode(der);
      let algorithmCheck: string;

      // Get the algorithm
      try {
        // for Ed25519
        algorithmCheck = decoded.toPrettyString().split('\n')[3].split('|')[1];
        if (!algorithmCheck) {
          // for Secp256k1
          algorithmCheck = decoded
            .toPrettyString()
            .split('\n')[4]
            .split('|')[1];
        }
        if (!algorithmCheck) {
          this.errors.capture(
            Promise.reject('Could not parse algorithm from DER encoding')
          );
        }
        if (algorithmCheck === 'curveEd25519') {
          this.algorithm.onChange('ed25519');
          let hexKey = decoded.toPrettyString().split('\n')[4].split('|')[1];
          this.secretKeyBase64.onChange(encodeBase64(decodeBase16(hexKey)));
        } else {
          this.algorithm.onChange(algorithmCheck);
          let hexKey = decoded.toPrettyString().split('\n')[2].split('|')[1];
          this.secretKeyBase64.onChange(encodeBase64(decodeBase16(hexKey)));
        }
      } catch (err) {
        this.errors.capture(Promise.reject(err));
      }
    } catch (e) {
      this.errors.capture(Promise.reject(e));
    }
  }

  private checkFileContent(fileContent: string) {
    if (!fileContent) {
      return 'The content of imported file cannot be empty!';
    }
    if (fileContent.includes('PUBLIC KEY')) {
      return 'Not a secret key file!';
    }
    return null;
  }

  constructor(private errors: ErrorContainer) {}

  handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (this.errors.lastError) {
      this.errors.dismissLast();
    }
    if (e.target.files) {
      this.file = e.target.files[0];
      const reader = new FileReader();
      reader.readAsText(this.file);
      reader.onload = e => {
        const fileContents = reader.result as string;
        const errorMsg = this.checkFileContent(fileContents);
        if (errorMsg === null) {
          const file = this.file?.name!.split('.');
          if (file === undefined) {
            this.errors.capture(Promise.reject(new Error('File undefined')));
          } else {
            // File is defined now check format by extension
            const fileExt = file[1];
            if (fileExt !== 'pem') {
              this.errors.capture(
                Promise.reject(
                  new Error(
                    `Invalid file format: .${fileExt}. Please upload a .pem file.`
                  )
                )
              );
            } else {
              try {
                this.parseAlgorithm(fileContents);
              } catch (e) {
                this.errors.capture(
                  Promise.reject(new Error('Failed to parse key'))
                );
              }
            }
          }
        } else {
          this.errors.capture(Promise.reject(new Error(errorMsg)));
        }
      };
    }
  };

  @computed
  get submitDisabled(): boolean {
    return !(
      fieldSubmittable(this.secretKeyBase64) &&
      fieldSubmittable(this.name) &&
      fieldSubmittable(this.algorithm)
    );
  }

  @action
  resetFields() {
    this.secretKeyBase64.reset();
    this.algorithm.reset();
    this.name.reset();
  }
}

export class CreateAccountFormData extends ImportAccountFormData {
  publicKey: FieldState<string> = new FieldState<string>('').validators(
    valueRequired
  );

  constructor(errors: ErrorContainer) {
    super(errors);
    this.algorithm.onUpdate(fieldState => {
      switch (fieldState.value) {
        case 'ed25519': {
          let ed25519KP = Keys.Ed25519.new();
          this.publicKey.onChange(ed25519KP.publicKey.toHex());
          this.secretKeyBase64.onChange(encodeBase64(ed25519KP.privateKey));
          break;
        }
        case 'secp256k1': {
          let secp256k1KP = Keys.Secp256K1.new();
          this.publicKey.onChange(secp256k1KP.publicKey.toHex());
          this.secretKeyBase64.onChange(encodeBase64(secp256k1KP.privateKey));
          break;
        }
        default:
          throw new Error('Invalid algorithm');
      }
    });
  }

  @computed
  get submitDisabled(): boolean {
    return !(
      fieldSubmittable(this.secretKeyBase64) &&
      fieldSubmittable(this.name) &&
      fieldSubmittable(this.publicKey)
    );
  }

  @action
  resetFields() {
    super.resetFields();
    this.publicKey.reset();
  }
}
