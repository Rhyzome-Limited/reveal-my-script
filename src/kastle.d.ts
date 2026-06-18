export interface KastleAccount {
  address: string;
  publicKey: string;
}

export interface KastleUtxoOutpoint {
  transactionId: string;
  index: number;
}

export interface KastleScriptPublicKey {
  version: number;
  script: string;
}

export interface KastleUtxoEntry {
  address?: string;
  outpoint: KastleUtxoOutpoint;
  amount: string;
  scriptPublicKey: string;
  blockDaaScore: string;
  isCoinbase: boolean;
}

export interface KastleBuildOutput {
  address: string;
  amount: string;
}

export interface KastlePendingTx {
  id: string;
  feeAmount: string;
  changeAmount: string;
  txJson: string;
}

export interface KastleBuildResult {
  networkId: string;
  transactions: KastlePendingTx[];
}

export interface KastleSignScript {
  inputIndex: number;
  scriptHex: string;
  signType?: string;
}

export interface KastleCommitRevealResult {
  commitTxId: string;
  revealTxId: string;
}

export interface Kastle {
  connect(): Promise<boolean>;
  getVersion(): Promise<string>;
  getAccount(): Promise<KastleAccount>;
  getNetwork(): Promise<string>;
  switchNetwork(networkId: string): Promise<string>;
  getBalance(): Promise<{ balance: string }>;
  getUtxoEntries(): Promise<{ entries: KastleUtxoEntry[] }>;
  sendKaspa(
    toAddress: string,
    sompi: number,
    options?: { priorityFee?: number; payload?: string },
  ): Promise<string>;
  buildTransaction(
    outputs: KastleBuildOutput[],
    options?: {
      priorityFee?: string;
      payload?: string;
      inputs?: KastleUtxoEntry[];
      sigOpCount?: number;
    },
  ): Promise<KastleBuildResult>;
  signAndBroadcastTx(
    networkId: string,
    txJson: string,
    scripts?: KastleSignScript[],
  ): Promise<string>;
  signTx(
    networkId: string,
    txJson: string,
    scripts?: KastleSignScript[],
  ): Promise<string>;
  signMessage(message: string): Promise<string>;
  commitReveal(
    networkId: string,
    namespace: string,
    data: string,
    options?: object,
  ): Promise<KastleCommitRevealResult>;
  compoundUtxos(options?: { priorityFee?: string }): Promise<string>;
  on(event: string, handler: (data: unknown) => void): void;
  removeListener(event: string, handler: (data: unknown) => void): void;
  request(method: string, args?: unknown): Promise<unknown>;
}

declare global {
  interface Window {
    kastle?: Kastle;
  }
}
