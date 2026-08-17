import { useCallback, useEffect, useRef, useState } from 'react';
import { getRawDataCount, type ConnectivityResult } from './api';
import { notifySuccess, notifyError } from './notify';

// Polls the BH Sensors REST API to prove DB connectivity.
// Runs a Sum sanity check + GetRawDataCount, exposing status for the UI.
export function useConnectivity(autoRefreshMs = 30000) {
  const [result, setResult] = useState<ConnectivityResult>({
    status: 'idle',
    rawDataCount: null,
    error: null,
    checkedAt: null,
  });

  // Track previous status so we only notify on transitions (not every poll).
  const prevStatus = useRef<ConnectivityResult['status']>('idle');

  const refresh = useCallback(async () => {
    setResult((r) => ({ ...r, status: 'checking', error: null }));
    try {
      // One call proves both service reachability and DB access. (The old
      // Sum endpoint was removed server-side and now 404s.)
      const count = await getRawDataCount();
      if (prevStatus.current === 'offline') {
        notifySuccess('Connection restored', 'Sensor network is back online');
      }
      prevStatus.current = 'online';
      setResult({
        status: 'online',
        rawDataCount: count,
        error: null,
        checkedAt: Date.now(),
      });
    } catch (e) {
      if (prevStatus.current === 'online') {
        notifyError('Connection lost', 'Unable to reach the sensor network');
      }
      prevStatus.current = 'offline';
      setResult({
        status: 'offline',
        rawDataCount: null,
        error: e instanceof Error ? e.message : 'Connection failed',
        checkedAt: Date.now(),
      });
    }
  }, []);

  useEffect(() => {
    void refresh();
    if (autoRefreshMs <= 0) return;
    const id = setInterval(() => void refresh(), autoRefreshMs);
    return () => clearInterval(id);
  }, [refresh, autoRefreshMs]);

  return { ...result, refresh };
}
