import type { KastleAccount } from '../kastle';

interface Props {
  connected: boolean;
  account: KastleAccount | null;
  network: string | null;
  onConnect: () => void;
  detected: boolean;
}

export function Header({ connected, account, network, onConnect, detected }: Props) {
  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-6 h-[60px] bg-[#0d1120]/95 border-b border-[#1e2535] backdrop-blur-md">
      <div className="flex items-center gap-3">
        <span className="text-2xl text-[#4fc2a0] leading-none">⬡</span>
        <span className="text-lg font-bold text-white tracking-tight">Reveal My Script</span>
      </div>

      <div className="flex items-center gap-3">
        {connected && network && (
          <span className="text-[11px] font-semibold text-[#4fc2a0] bg-[#4fc2a0]/10 px-3 py-1 rounded-full uppercase tracking-widest border border-[#4fc2a0]/20">
            {network}
          </span>
        )}
        {connected && account ? (
          <span className="text-xs font-mono text-slate-400 bg-[#161b27] px-3 py-1.5 rounded-lg border border-[#1e2535]">
            {account.address.slice(0, 16)}…{account.address.slice(-6)}
          </span>
        ) : (
          <button
            onClick={onConnect}
            disabled={!detected}
            title={!detected ? 'Kastle wallet not detected' : 'Connect Kastle'}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#4fc2a0] text-[#0a0e1a] hover:bg-[#3aac8b] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {!detected ? 'Install Kastle' : 'Connect Kastle'}
          </button>
        )}
      </div>
    </header>
  );
}
