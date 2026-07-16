import { useCallback, useEffect, useState } from 'react';
import { usePromo } from './promoStore';

// ---------------------------------------------------------------------------
// Subscription tier logic (Stripe wiring deferred — mock entitlement state).
// A single source of truth for what each tier unlocks. Premium can be granted
// either by an active subscription OR by redeeming a partner access code.
// ---------------------------------------------------------------------------

export type Tier = 'free' | 'premium';

export type Feature =
  | 'smart_alerts'
  | 'full_history'
  | 'remote_control'
  | 'unlimited_sensors'
  | 'cloud_sync'
  | 'data_export';

export interface TierLimits {
  /** Max sensors a free user can actively monitor. */
  maxSensors: number;
  /** How many hours of history a free user can view. */
  historyHours: number;
  /** Whether smart alert engine is enabled. */
  smartAlerts: boolean;
  /** Whether remote device control is enabled. */
  remoteControl: boolean;
}

export const TIER_LIMITS: Record<Tier, TierLimits> = {
  free: {
    maxSensors: 3,
    historyHours: 24,
    smartAlerts: false,
    remoteControl: false,
  },
  premium: {
    maxSensors: Infinity,
    historyHours: Infinity,
    smartAlerts: true,
    remoteControl: true,
  },
};

const PREMIUM_FEATURES: Feature[] = [
  'smart_alerts',
  'full_history',
  'remote_control',
  'unlimited_sensors',
  'cloud_sync',
  'data_export',
];

export interface FeatureMeta {
  key: Feature;
  label: string;
  description: string;
  icon: string;
}

export const FEATURE_CATALOG: FeatureMeta[] = [
  {
    key: 'smart_alerts',
    label: 'Smart Alerts',
    description: 'Real-time leak, freeze & offline detection with priority ranking',
    icon: 'notifications',
  },
  {
    key: 'full_history',
    label: 'Unlimited History',
    description: 'View 30-day trends instead of the last 24 hours',
    icon: 'analytics',
  },
  {
    key: 'remote_control',
    label: 'Remote Control',
    description: 'Toggle and configure controllable devices from anywhere',
    icon: 'options',
  },
  {
    key: 'unlimited_sensors',
    label: 'Unlimited Sensors',
    description: 'Monitor more than 3 sensors at once',
    icon: 'hardware-chip',
  },
  {
    key: 'cloud_sync',
    label: 'Cloud Sync',
    description: 'Sync names & settings across unlimited devices',
    icon: 'cloud-done',
  },
  {
    key: 'data_export',
    label: 'Data Export',
    description: 'Export sensor history as CSV for reporting',
    icon: 'download',
  },
];

/**
 * Central entitlement hook. Resolves the active tier from the (mock)
 * subscription state plus any redeemed promo code, and exposes helpers
 * for gating features and enforcing limits across the app.
 */
export function useSubscription() {
  const { promoUnlocked, ready } = usePromo();

  // Mock subscription state — replaced by Stripe webhook status later.
  const [subscribed, setSubscribed] = useState(false);

  const tier: Tier = promoUnlocked || subscribed ? 'premium' : 'free';
  const isPremium = tier === 'premium';
  const limits = TIER_LIMITS[tier];

  const hasFeature = useCallback(
    (feature: Feature): boolean => {
      if (isPremium) return true;
      return !PREMIUM_FEATURES.includes(feature);
    },
    [isPremium],
  );

  const canAddSensor = useCallback(
    (currentCount: number): boolean => currentCount < limits.maxSensors,
    [limits.maxSensors],
  );

  const historyWindowHours = limits.historyHours;

  return {
    tier,
    isPremium,
    ready,
    limits,
    hasFeature,
    canAddSensor,
    historyWindowHours,
    // For demo/testing toggles (Stripe replaces this).
    activateMockSubscription: () => setSubscribed(true),
    cancelMockSubscription: () => setSubscribed(false),
  };
}

/** Convenience predicate usable outside React. */
export function featureRequiresPremium(feature: Feature): boolean {
  return PREMIUM_FEATURES.includes(feature);
}
