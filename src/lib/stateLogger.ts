import { useCallback, useMemo } from 'react';
import type { Sensor } from './mockData';

// Developer-facing application state logger. Aggregates the live internal
// state of the app into a single structured snapshot and prints it to the
// JS console (visible in Metro / Expo logs) for immediate debugging and
// status verification. Returns the same snapshot so a debug UI can render it.

export interface AppStateSnapshot {
  capturedAt: string;
  session: {
    authenticated: boolean;
    userId: string | null;
    email: string | null;
  };
  api: {
    status: string;
    rawDataCount: number | null;
  };
  sensors: {
    total: number;
    online: number;
    warning: number;
    offline: number;
    poweredOn: number;
  };
  alerts: {
    total: number;
    critical: number;
    warning: number;
    info: number;
  };
  subscription: {
    tier: string;
    isPremium: boolean;
  };
}

export interface StateLoggerInputs {
  authenticated: boolean;
  userId?: string | null;
  email?: string | null;
  apiStatus: string;
  rawDataCount: number | null;
  sensors: Sensor[];
  alertCounts: { critical: number; warning: number; info: number; total: number };
  tier: string;
  isPremium: boolean;
}

export function buildSnapshot(input: StateLoggerInputs): AppStateSnapshot {
  const online = input.sensors.filter((s) => s.status === 'online').length;
  const warning = input.sensors.filter((s) => s.status === 'warning').length;
  const offline = input.sensors.filter((s) => s.status === 'offline').length;
  const poweredOn = input.sensors.filter((s) => s.isOn).length;

  return {
    capturedAt: new Date().toISOString(),
    session: {
      authenticated: input.authenticated,
      userId: input.userId ?? null,
      email: input.email ?? null,
    },
    api: {
      status: input.apiStatus,
      rawDataCount: input.rawDataCount,
    },
    sensors: {
      total: input.sensors.length,
      online,
      warning,
      offline,
      poweredOn,
    },
    alerts: {
      total: input.alertCounts.total,
      critical: input.alertCounts.critical,
      warning: input.alertCounts.warning,
      info: input.alertCounts.info,
    },
    subscription: {
      tier: input.tier,
      isPremium: input.isPremium,
    },
  };
}

export function logSnapshot(snapshot: AppStateSnapshot): void {
  // Grouped, readable console output for debugging in Metro / Expo logs.
  /* eslint-disable no-console */
  console.log('%c[AMBIENT STATE]', 'color:#2DD4BF;font-weight:bold', snapshot.capturedAt);
  console.log('  session  →', snapshot.session);
  console.log('  api      →', snapshot.api);
  console.log('  sensors  →', snapshot.sensors);
  console.log('  alerts   →', snapshot.alerts);
  console.log('  billing  →', snapshot.subscription);
  /* eslint-enable no-console */
}

export function useStateLogger(input: StateLoggerInputs) {
  const snapshot = useMemo(() => buildSnapshot(input), [input]);

  const log = useCallback(() => {
    const snap = buildSnapshot(input);
    logSnapshot(snap);
    return snap;
  }, [input]);

  return { snapshot, log };
}
