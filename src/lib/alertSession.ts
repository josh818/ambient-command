import { useEffect, useState } from 'react';
import type { SmartAlert } from './alerts';

// Session-scoped alert bookkeeping. Smart alerts are derived (re-evaluated on
// every render from live sensor data), so acknowledgements and "first seen"
// timestamps live here in a module singleton — they persist while the app is
// open (across tab switches / navigation) and reset on a fresh launch.

interface AlertSessionState {
  acknowledged: ReadonlySet<string>;
  firstSeen: ReadonlyMap<string, number>;
  lastCheckedAt: number;
}

let acknowledged = new Set<string>();
const firstSeen = new Map<string, number>();
let lastCheckedAt = Date.now();

type Listener = () => void;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l());
}

function snapshot(): AlertSessionState {
  return { acknowledged, firstSeen, lastCheckedAt };
}

/**
 * Record the current alert set: stamps "first seen" for newly appearing alert
 * ids, drops acks for alerts that resolved themselves, and updates the
 * last-checked time. Call whenever alerts are re-evaluated.
 */
export function trackAlerts(alerts: SmartAlert[]) {
  const now = Date.now();
  let changed = false;
  const activeIds = new Set(alerts.map((a) => a.id));

  for (const a of alerts) {
    if (!firstSeen.has(a.id)) {
      firstSeen.set(a.id, now);
      changed = true;
    }
  }
  // An alert that cleared on its own shouldn't stay acknowledged — if it
  // re-fires later it is a new event and must resurface.
  for (const id of [...acknowledged]) {
    if (!activeIds.has(id)) {
      acknowledged.delete(id);
      changed = true;
    }
  }
  if (Math.abs(now - lastCheckedAt) > 1000) {
    lastCheckedAt = now;
    changed = true;
  }
  if (changed) emit();
}

export function acknowledgeAlert(id: string) {
  if (acknowledged.has(id)) return;
  acknowledged = new Set(acknowledged);
  acknowledged.add(id);
  emit();
}

export function acknowledgeAlerts(ids: string[]) {
  acknowledged = new Set(acknowledged);
  ids.forEach((id) => acknowledged.add(id));
  emit();
}

export function alertFirstSeen(id: string): number {
  return firstSeen.get(id) ?? Date.now();
}

export function useAlertSession(): AlertSessionState {
  const [, setTick] = useState(0);
  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return snapshot();
}
