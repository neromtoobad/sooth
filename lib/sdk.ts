// casper-js-sdk is CJS-only; under ESM its named exports aren't statically
// visible to node. import the default and re-export the names we use.
import type * as SDK from 'casper-js-sdk';
import casperSdk from 'casper-js-sdk';

const sdk = casperSdk as unknown as typeof SDK;

export const {
  AccountIdentifier,
  Args,
  CLValue,
  ContractCallBuilder,
  HttpHandler,
  Key,
  KeyAlgorithm,
  NativeTransferBuilder,
  PrivateKey,
  PublicKey,
  PurseIdentifier,
  RpcClient,
  SessionBuilder,
} = sdk;

export type { PrivateKey as PrivateKeyT, Transaction } from 'casper-js-sdk';
