import { useState, useEffect } from 'react';
import initWasm from '../wasm/kaspa.js';

export {
  payToScriptHashScript,
  addressFromScriptPublicKey,
  ScriptBuilder,
  Opcodes,
  PublicKey,
} from '../wasm/kaspa.js';

let initPromise: Promise<void> | null = null;

function ensureInit(): Promise<void> {
  if (!initPromise) {
    initPromise = initWasm().then(() => undefined);
  }
  return initPromise;
}

export function useKaspaWasm() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ensureInit()
      .then(() => setReady(true))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  return { ready, error };
}
