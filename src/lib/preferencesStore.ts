import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Local-first application preferences. Persisted per-device via AsyncStorage
// so the Settings screen stays responsive and works offline. Cloud sync of
// sensor names/power lives in sensorStore; these are UI/notification prefs.

export interface Preferences {
  leakAlerts: boolean;
  freezeAlerts: boolean;
  offlineAlerts: boolean;
  batteryAlerts: boolean;
  pushEnabled: boolean;
  haptics: boolean;
  temperatureUnit: 'C' | 'F';
  liveUpdates: boolean;
}

const DEFAULTS: Preferences = {
  leakAlerts: true,
  freezeAlerts: true,
  offlineAlerts: true,
  batteryAlerts: true,
  pushEnabled: true,
  haptics: true,
  temperatureUnit: 'F',
  liveUpdates: true,
};

const KEY = 'ambient:preferences';

type Listener = () => void;

let prefs: Preferences = { ...DEFAULTS };
let loaded = false;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l());
}

async function hydrate() {
  if (loaded) return;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) prefs = { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    // ignore corrupt data
  }
  loaded = true;
  emit();
}

export function usePreferences() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    listeners.add(listener);
    void hydrate();
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const setPref = useCallback(
    async <K extends keyof Preferences>(key: K, value: Preferences[K]): Promise<void> => {
      prefs = { ...prefs, [key]: value };
      emit();
      try {
        await AsyncStorage.setItem(KEY, JSON.stringify(prefs));
      } catch {
        // ignore write errors
      }
    },
    [],
  );

  const reset = useCallback(async (): Promise<void> => {
    prefs = { ...DEFAULTS };
    emit();
    try {
      await AsyncStorage.setItem(KEY, JSON.stringify(prefs));
    } catch {
      // ignore
    }
  }, []);

  return { prefs, ready: loaded, setPref, reset };
}
