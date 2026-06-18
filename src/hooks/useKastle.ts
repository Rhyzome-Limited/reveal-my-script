import { useState, useEffect, useCallback } from 'react';
import type { KastleAccount } from '../kastle';

export function useKastle() {
  const [connected, setConnected] = useState(false);
  const [account, setAccount] = useState<KastleAccount | null>(null);
  const [network, setNetwork] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const detected = typeof window !== 'undefined' && !!window.kastle;

  useEffect(() => {
    if (!detected || !window.kastle) return;

    const onAccountChanged = (addr: unknown) => {
      if (!addr) {
        setConnected(false);
        setAccount(null);
        setNetwork(null);
      }
    };

    const onNetworkChanged = (net: unknown) => {
      if (typeof net === 'string') setNetwork(net);
    };

    window.kastle.on('kas:account_changed', onAccountChanged);
    window.kastle.on('kas:network_changed', onNetworkChanged);

    return () => {
      window.kastle?.removeListener('kas:account_changed', onAccountChanged);
      window.kastle?.removeListener('kas:network_changed', onNetworkChanged);
    };
  }, [detected]);

  const connect = useCallback(async () => {
    if (!detected || !window.kastle) {
      setError('Kastle wallet not detected. Please install Kastle.');
      return;
    }
    try {
      setError(null);
      const ok = await window.kastle.connect();
      if (!ok) throw new Error('Connection rejected');
      const acc = await window.kastle.getAccount();
      const net = await window.kastle.getNetwork();
      setAccount(acc);
      setNetwork(net);
      setConnected(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [detected]);

  return { detected, connected, account, network, connect, error };
}
