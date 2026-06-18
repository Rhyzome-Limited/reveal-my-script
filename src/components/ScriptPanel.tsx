import { useState, useMemo } from 'react';
import {
  ScriptBuilder,
  Opcodes,
  PublicKey,
  payToScriptHashScript,
  addressFromScriptPublicKey,
} from '../hooks/useKaspaWasm';
import type { KastleAccount } from '../kastle';

interface FieldDef {
  key: string;
  label: string;
  placeholder: string;
  hint?: string;
  optional?: boolean;
  wide?: boolean;
}

interface OpConfig {
  label: string;
  fields: FieldDef[];
  base: Record<string, string>;
  isCustom?: 'json' | 'hex';
}

const OPS: Record<string, OpConfig> = {
  mint: {
    label: 'Mint',
    fields: [
      { key: 'tick', label: 'Ticker', placeholder: 'TICK', hint: '4–6 letters' },
      { key: 'to', label: 'To Address', placeholder: 'defaults to sender', optional: true, wide: true },
    ],
    base: { p: 'krc-20', op: 'mint' },
  },
  transfer: {
    label: 'Transfer',
    fields: [
      { key: 'tick', label: 'Ticker', placeholder: 'TICK', hint: '4–6 letters' },
      { key: 'amt', label: 'Amount', placeholder: '1000' },
      { key: 'to', label: 'To Address', placeholder: 'kaspa:q...', wide: true },
      { key: 'memo', label: 'Memo', placeholder: 'optional', optional: true, wide: true },
    ],
    base: { p: 'krc-20', op: 'transfer' },
  },
  deploy: {
    label: 'Deploy',
    fields: [
      { key: 'tick', label: 'Ticker', placeholder: 'TICK', hint: '4–6 letters' },
      { key: 'max', label: 'Max Supply', placeholder: '21000000' },
      { key: 'lim', label: 'Mint Limit', placeholder: '1000' },
      { key: 'dec', label: 'Decimals', placeholder: '8', optional: true },
      { key: 'pre', label: 'Pre-mint', placeholder: '0', optional: true },
      { key: 'to', label: 'To Address', placeholder: 'defaults to sender', optional: true, wide: true },
    ],
    base: { p: 'krc-20', op: 'deploy' },
  },
  list: {
    label: 'List',
    fields: [
      { key: 'tick', label: 'Ticker', placeholder: 'TICK', hint: '4–6 letters' },
      { key: 'amt', label: 'Amount', placeholder: '1000' },
    ],
    base: { p: 'krc-20', op: 'list' },
  },
  'custom-json': {
    label: 'Custom JSON',
    fields: [],
    base: {},
    isCustom: 'json',
  },
  'custom-hex': {
    label: 'Custom Hex',
    fields: [],
    base: {},
    isCustom: 'hex',
  },
};

const OP_ORDER = ['mint', 'transfer', 'deploy', 'list', 'custom-json', 'custom-hex'];

interface Props {
  wasmReady: boolean;
  network: string | null;
  account: KastleAccount | null;
  onAddressComputed: (address: string, scriptHex: string) => void;
}

export function ScriptPanel({ wasmReady, network, account, onAddressComputed }: Props) {
  const [opType, setOpType] = useState('mint');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [namespace, setNamespace] = useState('kasplex');
  const [customJson, setCustomJson] = useState('{\n  \n}');
  const [customHex, setCustomHex] = useState('');
  const [p2shAddress, setP2shAddress] = useState('');
  const [debugInfo, setDebugInfo] = useState<{ xOnly: string; scriptHex: string } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [jsonIndent, setJsonIndent] = useState(true);

  const config = OPS[opType];

  function setField(key: string, val: string) {
    setFields((prev) => ({ ...prev, [`${opType}.${key}`]: val }));
  }

  function getField(key: string): string {
    return fields[`${opType}.${key}`] ?? '';
  }

  const jsonPreview = useMemo(() => {
    if (config.isCustom) return null;
    const data: Record<string, string> = { ...config.base };
    for (const f of config.fields) {
      const val = getField(f.key);
      if (val) data[f.key] = val;
    }
    return jsonIndent ? JSON.stringify(data, null, 2) : JSON.stringify(data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opType, fields, config, jsonIndent]);

  function buildViaScriptBuilder(jsonData: string): string {
    if (!account) throw new Error('Connect Kastle first — need public key');
    const pk = new PublicKey(account.publicKey.trim());
    const xOnly = pk.toXOnlyPublicKey().toString().trim();
    const enc = new TextEncoder();
    const script = new ScriptBuilder()
      .addData(xOnly)
      .addOp(Opcodes.OpCheckSig)
      .addOp(Opcodes.OpFalse)
      .addOp(Opcodes.OpIf)
      .addData(enc.encode(namespace.trim()))
      .addI64(0n)
      .addData(enc.encode(jsonData))
      .addOp(Opcodes.OpEndIf);
    const scriptHex = script.toString();
    setDebugInfo({ xOnly, scriptHex });
    return scriptHex;
  }

  async function handleBuild() {
    if (!wasmReady || !network) return;
    setLoading(true);
    setError('');
    setP2shAddress('');
    try {
      let scriptHex: string;

      if (config.isCustom === 'hex') {
        if (!customHex.trim()) throw new Error('Script hex is required');
        scriptHex = customHex.trim();
      } else if (config.isCustom === 'json') {
        let parsed: unknown;
        try {
          parsed = JSON.parse(customJson);
        } catch {
          throw new Error('Invalid JSON');
        }
        scriptHex = buildViaScriptBuilder(JSON.stringify(parsed));
      } else {
        const data: Record<string, string> = { ...config.base };
        for (const f of config.fields) {
          const val = getField(f.key);
          if (val) data[f.key] = val;
        }
        scriptHex = buildViaScriptBuilder(jsonIndent ? JSON.stringify(data, null, 2) : JSON.stringify(data));
      }

      const scriptPubKey = payToScriptHashScript(scriptHex);
      const addr = addressFromScriptPublicKey(scriptPubKey, network);
      if (!addr) throw new Error('Failed to derive P2SH address');
      const addrStr = addr.toString();
      setP2shAddress(addrStr);
      onAddressComputed(addrStr, scriptHex);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const needsAccount = config.isCustom !== 'hex';
  const canBuild = wasmReady && !!network && !loading &&
    (!needsAccount || !!account) &&
    (config.isCustom === 'hex' ? !!customHex.trim() : true);

  const buildLabel = !wasmReady
    ? 'Loading WASM…'
    : !network
    ? 'Connect wallet first'
    : needsAccount && !account
    ? 'Connect wallet first'
    : loading
    ? 'Building…'
    : 'Build Script & Get Address';

  return (
    <div className="bg-[#161b27] border border-[#1e2535] rounded-2xl p-6 flex flex-col gap-5">
      <div>
        <h2 className="text-base font-semibold text-white mb-1">Script</h2>
        <p className="text-sm text-slate-500">Choose an operation to build the commit-reveal script</p>
      </div>

      {/* Op type tabs */}
      <div className="flex flex-wrap gap-1 bg-[#0d1120] p-1 rounded-xl">
        {OP_ORDER.map((op) => (
          <button
            key={op}
            onClick={() => { setOpType(op); setP2shAddress(''); setError(''); }}
            className={`flex-1 min-w-[80px] py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              opType === op
                ? 'bg-[#4fc2a0] text-[#0a0e1a]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {OPS[op].label}
          </button>
        ))}
      </div>

      {/* Custom Hex */}
      {config.isCustom === 'hex' && (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-400">Script Hex</label>
          <textarea
            value={customHex}
            onChange={(e) => setCustomHex(e.target.value)}
            placeholder="20ab3f...ac"
            rows={4}
            spellCheck={false}
            className="bg-[#0d1120] border border-[#1e2535] rounded-xl px-3 py-2 text-sm font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[#4fc2a0]/50 transition-colors resize-none"
          />
        </div>
      )}

      {/* Custom JSON */}
      {config.isCustom === 'json' && (
        <>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-400">Namespace</label>
            <input
              type="text"
              value={namespace}
              onChange={(e) => setNamespace(e.target.value)}
              className="bg-[#0d1120] border border-[#1e2535] rounded-xl px-3 py-2 text-sm font-mono text-slate-200 focus:outline-none focus:border-[#4fc2a0]/50 transition-colors"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-400">JSON Data</label>
            <textarea
              value={customJson}
              onChange={(e) => setCustomJson(e.target.value)}
              rows={8}
              spellCheck={false}
              className="bg-[#0d1120] border border-[#1e2535] rounded-xl px-3 py-2 text-sm font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[#4fc2a0]/50 transition-colors resize-y"
            />
          </div>
        </>
      )}

      {/* KRC-20 form fields */}
      {!config.isCustom && (
        <>
          <div className="grid grid-cols-2 gap-3">
            {config.fields.map((f) => (
              <div key={f.key} className={`flex flex-col gap-1 ${f.wide ? 'col-span-2' : ''}`}>
                <label className="text-xs font-medium text-slate-400">
                  {f.label}
                  {f.optional && <span className="text-slate-600 ml-1">(optional)</span>}
                  {f.hint && <span className="text-slate-600 ml-1">— {f.hint}</span>}
                </label>
                <input
                  type="text"
                  value={getField(f.key)}
                  onChange={(e) => setField(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className="bg-[#0d1120] border border-[#1e2535] rounded-xl px-3 py-2 text-sm font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[#4fc2a0]/50 transition-colors"
                  spellCheck={false}
                />
              </div>
            ))}

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-400">Namespace</label>
              <input
                type="text"
                value={namespace}
                onChange={(e) => setNamespace(e.target.value)}
                className="bg-[#0d1120] border border-[#1e2535] rounded-xl px-3 py-2 text-sm font-mono text-slate-200 focus:outline-none focus:border-[#4fc2a0]/50 transition-colors"
              />
            </div>
          </div>

          {/* JSON preview */}
          {jsonPreview && (
            <div className="bg-[#0d1120] border border-[#1e2535] rounded-xl px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">JSON Preview</div>
                <div className="flex items-center gap-1 bg-[#161b27] rounded-lg p-0.5">
                  <button
                    onClick={() => setJsonIndent(true)}
                    className={`text-[10px] px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer ${jsonIndent ? 'bg-[#4fc2a0] text-[#0a0e1a]' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    Indented
                  </button>
                  <button
                    onClick={() => setJsonIndent(false)}
                    className={`text-[10px] px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer ${!jsonIndent ? 'bg-[#4fc2a0] text-[#0a0e1a]' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    Compact
                  </button>
                </div>
              </div>
              <pre className="text-xs font-mono text-slate-400 whitespace-pre-wrap">{jsonPreview}</pre>
            </div>
          )}
        </>
      )}

      <button
        onClick={handleBuild}
        disabled={!canBuild}
        className="w-full py-2.5 text-sm font-semibold rounded-xl bg-[#4fc2a0] text-[#0a0e1a] hover:bg-[#3aac8b] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {buildLabel}
      </button>

      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {p2shAddress && (
        <div className="flex flex-col gap-3">
          <div className="bg-[#0d1120] border border-[#4fc2a0]/20 rounded-xl px-4 py-3">
            <div className="text-[11px] font-semibold text-[#4fc2a0] uppercase tracking-widest mb-1.5">P2SH Address</div>
            <div className="text-sm font-mono text-slate-200 break-all">{p2shAddress}</div>
          </div>

          {debugInfo && (
            <details className="bg-[#0d1120] border border-[#1e2535] rounded-xl px-4 py-3 group">
              <summary className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest cursor-pointer select-none">
                Debug Info
              </summary>
              <div className="mt-3 flex flex-col gap-3">
                <div>
                  <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    X-Only Public Key ({debugInfo.xOnly.length / 2} bytes)
                  </div>
                  <div className="text-xs font-mono text-slate-400 break-all">{debugInfo.xOnly}</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Script Hex ({debugInfo.scriptHex.length / 2} bytes)
                  </div>
                  <div className="text-xs font-mono text-slate-400 break-all">{debugInfo.scriptHex}</div>
                </div>
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
