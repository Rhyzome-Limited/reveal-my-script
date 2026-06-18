import { useState } from 'react';
import { Header } from './components/Header';
import { ScriptPanel } from './components/ScriptPanel';
import { UtxoList } from './components/UtxoList';
import { useKastle } from './hooks/useKastle';
import { useKaspaWasm } from './hooks/useKaspaWasm';

export default function App() {
  const { detected, connected, account, network, connect, error: kastleError } = useKastle();
  const { ready: wasmReady } = useKaspaWasm();

  const [p2shAddress, setP2shAddress] = useState<string | null>(null);
  const [scriptHex, setScriptHex] = useState('');

  function handleAddressComputed(address: string, hex: string) {
    setP2shAddress(address);
    setScriptHex(hex);
  }

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-slate-200">
      <Header
        connected={connected}
        account={account}
        network={network}
        onConnect={connect}
        detected={detected}
      />

      <main className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-5">
        {kastleError && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            {kastleError}
          </div>
        )}

        <ScriptPanel
          wasmReady={wasmReady}
          network={network}
          account={account}
          onAddressComputed={handleAddressComputed}
        />

        <UtxoList
          p2shAddress={p2shAddress}
          scriptHex={scriptHex}
          network={network}
          account={account}
        />
      </main>
    </div>
  );
}
