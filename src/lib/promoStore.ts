import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PROMO_KEY = 'ambient:promoUnlocked';

// Valid access codes that unlock Premium for free.
const VALID_CODES = ['BHSENSORS', 'AMBIENT2025', 'EARLYBIRD'];

type Listener = () => void;

let unlocked = false;
let loaded = false;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l());
}

async function hydrate() {
  if (loaded) return;
  try {
    const v = await AsyncStorage.getItem(PROMO_KEY);
    unlocked = v === 'true';
  } catch {
    // ignore
  }
  loaded = true;
  emit();
}

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/[\s-]/g, '');
}

export function isValidPromoCode(code: string): boolean {
  return VALID_CODES.includes(normalizeCode(code));
}

export function usePromo() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    listeners.add(listener);
    void hydrate();
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const redeemCode = useCallback(async (code: string): Promise<boolean> => {
    if (!isValidPromoCode(code)) return false;
    unlocked = true;
    emit();
    await AsyncStorage.setItem(PROMO_KEY, 'true');
    return true;
  }, []);

  const clearPromo = useCallback(async () => {
    unlocked = false;
    emit();
    await AsyncStorage.removeItem(PROMO_KEY);
  }, []);

  return {
    promoUnlocked: unlocked,
    ready: loaded,
    redeemCode,
    clearPromo,
  };
}
