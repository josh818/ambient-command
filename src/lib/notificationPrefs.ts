import { useCallback, useMemo } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { useSession } from '../../lib/auth-client';
import { api } from '../../convex/_generated/api';
import type { SmartAlert, AlertCategory } from './alerts';

// Cloud-synced notification preferences (Convex userPreferences table).
//
// GATING MODEL (see useSmartAlerts in alerts.ts):
// - Alerts are still evaluated internally for every category; a muted
//   category's alerts simply never surface in the UI / alert center.
// - During quiet hours, non-critical alerts (warning / info) are suppressed.
//   Critical (danger-level) alerts — most importantly active water leaks —
//   ALWAYS surface, quiet hours or not.

export interface NotificationPrefs {
  leak: boolean;
  connectivity: boolean;
  battery: boolean;
  usage: boolean;
  quietHoursEnabled: boolean;
  /** Local hour 0–23 when quiet hours begin. */
  quietHoursStart: number;
  /** Local hour 0–23 when quiet hours end. */
  quietHoursEnd: number;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  leak: true,
  connectivity: true,
  battery: true,
  usage: true,
  quietHoursEnabled: false,
  quietHoursStart: 22,
  quietHoursEnd: 7,
};

type PreferencesDoc = {
  notifyLeak?: boolean;
  notifyConnectivity?: boolean;
  notifyBattery?: boolean;
  notifyUsage?: boolean;
  quietHoursEnabled?: boolean;
  quietHoursStart?: number;
  quietHoursEnd?: number;
  usageGoal?: number;
} | null;

function fromDoc(doc: PreferencesDoc | undefined): NotificationPrefs {
  const d = doc ?? null;
  return {
    leak: d?.notifyLeak ?? DEFAULT_NOTIFICATION_PREFS.leak,
    connectivity: d?.notifyConnectivity ?? DEFAULT_NOTIFICATION_PREFS.connectivity,
    battery: d?.notifyBattery ?? DEFAULT_NOTIFICATION_PREFS.battery,
    usage: d?.notifyUsage ?? DEFAULT_NOTIFICATION_PREFS.usage,
    quietHoursEnabled: d?.quietHoursEnabled ?? DEFAULT_NOTIFICATION_PREFS.quietHoursEnabled,
    quietHoursStart: d?.quietHoursStart ?? DEFAULT_NOTIFICATION_PREFS.quietHoursStart,
    quietHoursEnd: d?.quietHoursEnd ?? DEFAULT_NOTIFICATION_PREFS.quietHoursEnd,
  };
}

/** Which preference toggle governs each alert category. */
const CATEGORY_TOGGLE: Record<AlertCategory, keyof NotificationPrefs> = {
  leak: 'leak',
  offline: 'connectivity',
  signal: 'connectivity',
  battery: 'battery',
  usage: 'usage',
};

/** True when `now` falls inside the quiet-hours window (handles midnight wrap). */
export function isInQuietHours(prefs: NotificationPrefs, now: Date = new Date()): boolean {
  if (!prefs.quietHoursEnabled) return false;
  const { quietHoursStart: start, quietHoursEnd: end } = prefs;
  if (start === end) return false; // zero-length window
  const h = now.getHours();
  return start < end ? h >= start && h < end : h >= start || h < end;
}

/**
 * Apply notification preferences to an evaluated alert set.
 * - Muted category → hidden (the alert still exists internally).
 * - Quiet hours → warning/info suppressed; danger-level (critical leak,
 *   offline, critical battery) always passes through.
 */
export function filterVisibleAlerts(
  alerts: SmartAlert[],
  prefs: NotificationPrefs,
  now: Date = new Date(),
): SmartAlert[] {
  const quiet = isInQuietHours(prefs, now);
  return alerts.filter((a) => {
    // Critical leak alerts always surface — safety trumps every setting.
    if (a.category === 'leak' && a.level === 'danger') return true;
    if (!prefs[CATEGORY_TOGGLE[a.category]]) return false;
    if (quiet && a.level !== 'danger') return false;
    return true;
  });
}

export function formatHour(h: number): string {
  const hr = ((h % 24) + 24) % 24;
  const period = hr < 12 ? 'AM' : 'PM';
  const display = hr % 12 === 0 ? 12 : hr % 12;
  return `${display}:00 ${period}`;
}

export interface NotificationPrefsState {
  prefs: NotificationPrefs;
  /** Monthly conservation goal (server-metric units), or null when unset. */
  usageGoal: number | null;
  /** False while the cloud query is still in flight for a signed-in user. */
  ready: boolean;
  save: (partial: Partial<NotificationPrefs & { usageGoal: number }>) => Promise<void>;
}

/**
 * Cloud notification preferences for the signed-in user. Signed-out users get
 * the defaults (everything on, quiet hours off).
 */
export function useNotificationPrefs(): NotificationPrefsState {
  const { data: session } = useSession();
  const doc = useQuery(api.queries.getMyPreferences, session ? {} : 'skip') as
    | PreferencesDoc
    | undefined;
  const upsert = useMutation(api.mutations.upsertPreferences);

  const prefs = useMemo(() => fromDoc(doc), [doc]);
  const usageGoal =
    doc && typeof doc.usageGoal === 'number' && doc.usageGoal > 0 ? doc.usageGoal : null;

  const save = useCallback(
    async (partial: Partial<NotificationPrefs & { usageGoal: number }>) => {
      await upsert({
        ...(partial.leak !== undefined ? { notifyLeak: partial.leak } : {}),
        ...(partial.connectivity !== undefined
          ? { notifyConnectivity: partial.connectivity }
          : {}),
        ...(partial.battery !== undefined ? { notifyBattery: partial.battery } : {}),
        ...(partial.usage !== undefined ? { notifyUsage: partial.usage } : {}),
        ...(partial.quietHoursEnabled !== undefined
          ? { quietHoursEnabled: partial.quietHoursEnabled }
          : {}),
        ...(partial.quietHoursStart !== undefined
          ? { quietHoursStart: partial.quietHoursStart }
          : {}),
        ...(partial.quietHoursEnd !== undefined
          ? { quietHoursEnd: partial.quietHoursEnd }
          : {}),
        ...(partial.usageGoal !== undefined ? { usageGoal: partial.usageGoal } : {}),
      });
    },
    [upsert],
  );

  return {
    prefs,
    usageGoal,
    ready: !session || doc !== undefined,
    save,
  };
}
