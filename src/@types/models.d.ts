import { Keys } from 'casper-js-sdk';

interface KeyPairWithAlias {
  // Human readable alias.
  alias: string;
  KeyPair: Keys.Ed25519 | Keys.Secp256K1;
}

type ByteArray = Uint8Array;
