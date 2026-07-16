import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FEATURE_CATALOG, featureRequiresPremium, type Feature } from './subscription';

// ---------------------------------------------------------------------------
// Lightweight usage-analytics store. Tracks how often each feature is used and
// how often premium-gated features are hit by free users (an "upgrade intent"
// signal). This data informs revenue modeling & premium-tier balancing.
// Persisted locally; would sync to Shipper Cloud analytics in production.
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'ambient:analytics:v1';

export type AnalyticsEvent =
  | { type: 'feature_used'; feature: Feature }
  | { type: 'gate_hit'; feature: Feature }
  | { type: 'upgrade_viewed' }
  | { type: 'upgrade_started' }
  | { type: 'screen_view'; screen: string };

interface AnalyticsState {
  featureUsage: Record<string, number>;
  gateHits: Record<string, number>;
  screenViews: Record<string, number>;
  upgradeViewed: number;
  upgradeStarted: number;
  firstSeen: number;
  lastEventAt: number;
  totalEvents: number;
}

function emptyState(): AnalyticsState {
  return {
    featureUsage: {},
    gateHits: {},
    screenViews: {},
    upgradeViewed: 0,
    upgradeStarted: 0,
    firstSeen: Date.now(),
    lastEventAt: Date.now(),
    totalEvents: 0,
  };
}

type Listener = () => void;

let state: AnalyticsState = emptyState();
let loaded = false;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l());
}

async function persist() {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

async function hydrate() {
  if (loaded) return;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      state = { ...emptyState(), ...JSON.parse(raw) };
    }
  } catch {
    // ignore
  }
  loaded = true;
  emit();
}

export function trackEvent(event: AnalyticsEvent) {
  state.totalEvents += 1;
  state.lastEventAt = Date.now();

  switch (event.type) {
    case 'feature_used':
      state.featureUsage[event.feature] = (state.featureUsage[event.feature] ?? 0) + 1;
      break;
    case 'gate_hit':
      state.gateHits[event.feature] = (state.gateHits[event.feature] ?? 0) + 1;
      break;
    case 'screen_view':
      state.screenViews[event.screen] = (state.screenViews[event.screen] ?? 0) + 1;
      break;
    case 'upgrade_viewed':
      state.upgradeViewed += 1;
      break;
    case 'upgrade_started':
      state.upgradeStarted += 1;
      break;
  }
  emit();
  void persist();
}

export interface FeatureInsight {
  feature: Feature;
  label: string;
  icon: string;
  isPremium: boolean;
  uses: number;
  gateHits: number;
  /** Demand = total interest (uses + gate hits). */
  demand: number;
}

export interface RevenueModel {
  /** Conversion funnel. */
  upgradeViewed: number;
  upgradeStarted: number;
  /** % of upgrade views that became starts. */
  viewToStartRate: number;
  /** Sum of premium-gate hits — the core upgrade-intent signal. */
  totalGateHits: number;
  /** Projected monthly revenue at $4.99 from observed intent. */
  projectedMrr: number;
  /** Most-demanded premium feature (top driver of upgrades). */
  topDriver: FeatureInsight | null;
}

const PRICE = 4.99;
// Heuristic: a fraction of gate-hitters convert. Tunable.
const INTENT_CONVERSION = 0.18;

export function useAnalytics() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    void hydrate();
    return () => {
      listeners.delete(l);
    };
  }, []);

  const insights = useCallback((): FeatureInsight[] => {
    return FEATURE_CATALOG.map((f) => {
      const uses = state.featureUsage[f.key] ?? 0;
      const gateHits = state.gateHits[f.key] ?? 0;
      return {
        feature: f.key,
        label: f.label,
        icon: f.icon,
        isPremium: featureRequiresPremium(f.key),
        uses,
        gateHits,
        demand: uses + gateHits,
      };
    }).sort((a, b) => b.demand - a.demand);
  }, []);

  const revenueModel = useCallback((): RevenueModel => {
    const totalGateHits = Object.values(state.gateHits).reduce((a, b) => a + b, 0);
    const viewToStartRate =
      state.upgradeViewed > 0
        ? Math.round((state.upgradeStarted / state.upgradeViewed) * 100)
        : 0;
    const projectedConversions = Math.round(totalGateHits * INTENT_CONVERSION);
    const projectedMrr = Math.round(projectedConversions * PRICE * 100) / 100;

    const ranked = insights().filter((i) => i.isPremium);
    const topDriver = ranked.length > 0 && ranked[0].demand > 0 ? ranked[0] : null;

    return {
      upgradeViewed: state.upgradeViewed,
      upgradeStarted: state.upgradeStarted,
      viewToStartRate,
      totalGateHits,
      projectedMrr,
      topDriver,
    };
  }, [insights]);

  const reset = useCallback(async () => {
    state = emptyState();
    emit();
    await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    ready: loaded,
    totalEvents: state.totalEvents,
    firstSeen: state.firstSeen,
    screenViews: state.screenViews,
    insights: insights(),
    revenueModel: revenueModel(),
    reset,
  };
}
