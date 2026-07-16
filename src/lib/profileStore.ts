import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NAME_KEY = 'ambient:profileName';
const HOME_KEY = 'ambient:profileHome';

type Listener = () => void;

let displayName = '';
let homeName = '';
let loaded = false;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l());
}

async function hydrate() {
  if (loaded) return;
  try {
    const [n, h] = await Promise.all([
      AsyncStorage.getItem(NAME_KEY),
      AsyncStorage.getItem(HOME_KEY),
    ]);
    displayName = n ?? '';
    homeName = h ?? '';
  } catch {
    // ignore
  }
  loaded = true;
  emit();
}

export function useProfile() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    listeners.add(listener);
    void hydrate();
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const saveProfile = useCallback(
    async (name: string, home: string): Promise<void> => {
      displayName = name.trim();
      homeName = home.trim();
      emit();
      await Promise.all([
        AsyncStorage.setItem(NAME_KEY, displayName),
        AsyncStorage.setItem(HOME_KEY, homeName),
      ]);
    },
    [],
  );

  return {
    displayName,
    homeName,
    ready: loaded,
    saveProfile,
  };
}
