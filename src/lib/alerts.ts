import { useMemo } from 'react';
import type { Sensor } from './mockData';
import type { AlertLevel } from '../components/AlertNotification';

// Priority-based alert engine for a water-leak-only product.
// Evaluates the live sensor set against leak-specific rules and produces
// prioritized alerts. Active water leaks are always surfaced first, followed
// by connectivity loss, battery and signal warnings.

export type AlertCategory = 'leak' | 'offline' | 'battery' | 'signal';

export interface SmartAlert {
  id: string;
  sensorId: string;
  sensorName: string;
  location: string;
  level: AlertLevel;
  category: AlertCategory;
  title: string;
  message: string;
  recommendation: string;
  priority: number; // higher = more urgent
  detectedAt: number;
}

const categoryMeta: Record<
  AlertCategory,
  { icon: string; label: string }
> = {
  leak: { icon: 'water', label: 'Water Leak' },
  offline: { icon: 'cloud-offline', label: 'Connectivity' },
  battery: { icon: 'battery-dead', label: 'Battery' },
  signal: { icon: 'cellular', label: 'Signal' },
};

export function alertCategoryMeta(category: AlertCategory) {
  return categoryMeta[category];
}

const THRESHOLDS = {
  lowBattery: 20,
  criticalBattery: 10,
  lowSignal: 25,
};

export function evaluateAlerts(sensors: Sensor[]): SmartAlert[] {
  const out: SmartAlert[] = [];
  const at = Date.now();

  sensors.forEach((s) => {
    // Only alert on real server data — never on placeholder/unknown values.
    if (!s.hasTelemetry) return;
    const base = {
      sensorId: s.id,
      sensorName: s.defaultName,
      location: s.location,
      detectedAt: at,
    };

    // --- Critical: active water leak ---
    if (s.status !== 'offline' && s.value > 0) {
      out.push({
        ...base,
        id: `${s.id}-leak`,
        level: 'danger',
        category: 'leak',
        title: `Water detected — ${s.defaultName}`,
        message: `Moisture detected at ${s.location}. This indicates an active leak.`,
        recommendation: s.controllable
          ? 'Close the auto shut-off valve and inspect the area immediately.'
          : 'Shut off the nearest water supply and inspect the area immediately.',
        priority: 100,
      });
    }

    // --- Connectivity: offline ---
    if (s.status === 'offline') {
      out.push({
        ...base,
        id: `${s.id}-offline`,
        level: 'danger',
        category: 'offline',
        title: `${s.defaultName} offline`,
        message: `No signal from ${s.location}. This area is currently unprotected.`,
        recommendation: 'Check the sensor power source and Wi-Fi connectivity.',
        priority: 80,
      });
      return; // skip further checks for offline sensors
    }

    // --- Battery ---
    if (s.battery <= THRESHOLDS.criticalBattery) {
      out.push({
        ...base,
        id: `${s.id}-batt-crit`,
        level: 'danger',
        category: 'battery',
        title: `${s.defaultName} battery critical`,
        message: `Battery at ${s.battery}%. The detector may stop reporting at any moment.`,
        recommendation: 'Replace or recharge the battery now.',
        priority: 70,
      });
    } else if (s.battery <= THRESHOLDS.lowBattery) {
      out.push({
        ...base,
        id: `${s.id}-batt-low`,
        level: 'warning',
        category: 'battery',
        title: `${s.defaultName} low battery`,
        message: `Battery at ${s.battery}% — replace soon to avoid a gap in protection.`,
        recommendation: 'Schedule a battery replacement in the next few days.',
        priority: 40,
      });
    }

    // --- Weak signal ---
    if (s.signal > 0 && s.signal <= THRESHOLDS.lowSignal) {
      out.push({
        ...base,
        id: `${s.id}-signal`,
        level: 'info',
        category: 'signal',
        title: `${s.defaultName} weak signal`,
        message: `Signal strength is ${s.signal}% in ${s.location}.`,
        recommendation: 'Consider moving the detector closer to a hub or repeater.',
        priority: 15,
      });
    }
  });

  return out.sort((a, b) => b.priority - a.priority);
}

export function useSmartAlerts(sensors: Sensor[]) {
  return useMemo(() => {
    const alerts = evaluateAlerts(sensors);
    const critical = alerts.filter((a) => a.level === 'danger');
    const warnings = alerts.filter((a) => a.level === 'warning');
    const info = alerts.filter((a) => a.level === 'info');
    return {
      alerts,
      critical,
      warnings,
      info,
      counts: {
        total: alerts.length,
        critical: critical.length,
        warnings: warnings.length,
        info: info.length,
      },
    };
  }, [sensors]);
}
