import { useState } from 'react';
import useSWR from 'swr';
import type { KastleAccount, KastleUtxoEntry } from '../kastle';
import { fetchUtxos, formatSompi } from '../utils/api';

interface Props {
  p2shAddress: string | null;
  scriptHex: string;
  network: string | null;
  account: KastleAccount | null;
}

function utxoId(u: KastleUtxoEntry): string {
  return `${u.outpoint.transactionId}:${u.outpoint.index}`;
}

export function UtxoList({ p2shAddress, scriptHex, network, account }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [revealing, setRevealing] = useState(false);
  const [revealError, setRevealError] = useState('');
  const [txIds, setTxIds] = useState<string[]>([]);

  const swrKey = p2shAddress && network ? `${network}:${p2shAddress}` : null;

  const { data: utxos = [], error: fetchError, isLoading, mutate } = useSWR<KastleUtxoEntry[]>(
    swrKey,
    () => fetchUtxos(p2shAddress!, network!),
    { revalidateOnFocus: false }
  );

  function toggleUtxo(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(
      selected.size === utxos.length
        ? new Set()
        : new Set(utxos.map(utxoId))
    );
  }

  const selectedUtxos = utxos.filter((u) => selected.has(utxoId(u)));
  const totalSompi = selectedUtxos.reduce((sum, u) => sum + BigInt(u.amount), 0n);

  async function handleReveal() {
    if (!selectedUtxos.length || !account || !window.kastle) return;
    setRevealing(true);
    setRevealError('');
    setTxIds([]);
    try {
      // Fetch wallet UTXOs to cover fees
      const { entries: walletEntries } = await window.kastle.getUtxoEntries();

      const allInputs = [
        ...selectedUtxos,
        ...walletEntries.map((e) => ({
          ...e,
          scriptPublicKey: JSON.parse(e.scriptPublicKey),
        })),
      ];

      const { networkId, transactions } = await window.kastle.buildTransaction(
        [{ address: account.address, amount: totalSompi.toString()! }],
        { inputs: allInputs, sigOpCount: 1 }
      );

      const p2shOutpoints = new Set(selectedUtxos.map((u) => `${u.outpoint.transactionId}:${u.outpoint.index}`));

      const ids: string[] = [];
      for (const tx of transactions) {
        const parsed = JSON.parse(tx.txJson);
        const scripts = (parsed.inputs as Array<{ transactionId: string; index: number }>)
          .map((inp, i) => ({ inp, i }))
          .filter(({ inp }) => p2shOutpoints.has(`${inp.transactionId}:${inp.index}`))
          .map(({ i }) => ({ inputIndex: i, scriptHex }));
        const txId = await window.kastle.signAndBroadcastTx(networkId, tx.txJson, scripts);
        ids.push(txId);
      }

      setTxIds(ids);
      const revealedIds = new Set(selected);
      setSelected(new Set());
      await mutate(utxos.filter((u) => !revealedIds.has(utxoId(u))), { revalidate: true });
    } catch (e) {
      setRevealError(e instanceof Error ? e.message : String(e));
    } finally {
      setRevealing(false);
    }
  }

  if (!p2shAddress) return null;

  return (
    <div className="bg-[#161b27] border border-[#1e2535] rounded-2xl p-6 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white mb-1">UTXOs</h2>
          <p className="text-xs font-mono text-slate-500 break-all">{p2shAddress}</p>
        </div>
        <button
          onClick={() => mutate()}
          disabled={isLoading}
          className="text-xs px-3 py-1.5 rounded-lg border border-[#1e2535] text-slate-400 hover:text-white hover:border-[#4fc2a0]/40 transition-colors cursor-pointer disabled:opacity-40"
        >
          {isLoading ? 'Fetching…' : 'Refresh'}
        </button>
      </div>

      {fetchError && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          {fetchError instanceof Error ? fetchError.message : String(fetchError)}
        </div>
      )}

      {revealError && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          {revealError}
        </div>
      )}

      {txIds.length > 0 && (
        <div className="bg-[#4fc2a0]/10 border border-[#4fc2a0]/30 rounded-xl px-4 py-3">
          <div className="text-[11px] font-semibold text-[#4fc2a0] uppercase tracking-widest mb-2">Revealed!</div>
          {txIds.map((id) => (
            <div key={id} className="text-xs font-mono text-slate-300 break-all">{id}</div>
          ))}
        </div>
      )}

      {isLoading && (
        <div className="text-sm text-slate-500 text-center py-6">Fetching UTXOs…</div>
      )}

      {!isLoading && utxos.length === 0 && !fetchError && (
        <div className="text-sm text-slate-500 text-center py-6">No UTXOs at this address.</div>
      )}

      {utxos.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={selected.size === utxos.length && utxos.length > 0}
                onChange={toggleAll}
                className="accent-[#4fc2a0] w-4 h-4"
              />
              Select all ({utxos.length})
            </label>
            {selected.size > 0 && (
              <span className="text-sm font-semibold text-[#4fc2a0]">
                {formatSompi(totalSompi.toString())}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
            {utxos.map((u) => {
              const id = utxoId(u);
              const isSelected = selected.has(id);
              return (
                <label
                  key={id}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors select-none ${
                    isSelected
                      ? 'border-[#4fc2a0]/40 bg-[#4fc2a0]/5'
                      : 'border-[#1e2535] hover:border-[#2e3545]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleUtxo(id)}
                    className="accent-[#4fc2a0] w-4 h-4 mt-0.5 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-mono text-slate-400 truncate">
                      {u.outpoint.transactionId.slice(0, 24)}…:{u.outpoint.index}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm font-semibold text-white">{formatSompi(u.amount)}</span>
                      {u.isCoinbase && (
                        <span className="text-[10px] font-semibold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">coinbase</span>
                      )}
                      <span className="text-[11px] text-slate-600">daa {u.blockDaaScore}</span>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>

          <button
            onClick={handleReveal}
            disabled={selected.size === 0 || revealing || !account}
            title={!account ? 'Connect Kastle first' : ''}
            className="w-full py-3 text-sm font-semibold rounded-xl bg-[#4fc2a0] text-[#0a0e1a] hover:bg-[#3aac8b] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {revealing
              ? 'Revealing…'
              : selected.size > 0
              ? `Reveal ${selected.size} UTXO${selected.size > 1 ? 's' : ''}`
              : 'Select UTXOs to Reveal'}
          </button>
        </>
      )}
    </div>
  );
}
