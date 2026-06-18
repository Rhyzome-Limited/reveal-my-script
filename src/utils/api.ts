import type { KastleUtxoEntry } from '../kastle';

const API_BASES: Record<string, string> = {
  mainnet: 'https://api.kaspa.org',
  'testnet-10': 'https://api-tn10.kaspa.org',
  'testnet-11': 'https://api-tn11.kaspa.org',
};

export function getApiBase(network: string): string {
  return API_BASES[network] ?? API_BASES['mainnet'];
}

interface ApiUtxo {
  address: string;
  outpoint: { transactionId: string; index: number };
  utxoEntry: {
    amount: string;
    scriptPublicKey: { scriptPublicKey: string; version?: number };
    blockDaaScore: string;
    isCoinbase: boolean;
  };
}

export async function fetchUtxos(address: string, network: string): Promise<KastleUtxoEntry[]> {
  const base = getApiBase(network);
  const res = await fetch(`${base}/addresses/${address}/utxos`);
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as ApiUtxo[];
  return data.map((u) => ({
    address: u.address,
    outpoint: {
      transactionId: u.outpoint.transactionId,
      index: u.outpoint.index,
    },
    amount: u.utxoEntry.amount,
    scriptPublicKey: {
      version: u.utxoEntry.scriptPublicKey.version ?? 0,
      script: u.utxoEntry.scriptPublicKey.scriptPublicKey,
    },
    blockDaaScore: u.utxoEntry.blockDaaScore,
    isCoinbase: u.utxoEntry.isCoinbase,
  }));
}

export function formatSompi(sompi: string | bigint): string {
  const n = BigInt(sompi);
  const whole = n / 100_000_000n;
  const fracRaw = (n % 100_000_000n).toString().padStart(8, '0');
  const frac = fracRaw.replace(/0+$/, '');
  return frac ? `${whole}.${frac} KAS` : `${whole} KAS`;
}
