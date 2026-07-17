import { colors } from '../constants/theme';
import { isLeaking, type Sensor } from './mockData';
import type { SmartAlert } from './alerts';

// System health score (0–100) computed from the live sensor fleet.
//
// Weights:
//   50 pts — connectivity: fraction of reporting sensors that are online
//   30 pts — alerts: deductions per active alert by severity
//   20 pts — battery fleet: average battery health across reporting sensors
//
// DATA POLICY: the score is only computed from sensors that have real
// telemetry (hasTelemetry). If nothing has reported yet, score is null and
// the UI shows a neutral "standby" state instead of inventing a number.

export interface SystemHealth {
  /** 0–100, or null when no sensor has reported telemetry yet. */
  score: number | null;
  /** One-line status, e.g. "All systems nominal" / "2 sensors need attention". */
  statusLine: string;
  /** Sensors currently needing attention (offline, leaking, low battery). */
  problemCount: number;
  /** Ring/gauge accent color for the current score band. */
  color: string;
  /** Short label for the score band. */
  bandLabel: string;
}

function batteryFraction(s: Sensor): number {
  // Prefer a real percentage when present, else derive from battery volts
  // (single-cell LiPo style curve: 3.3V empty → 4.2V full), else neutral.
  if (s.battery > 0) return Math.min(1, Math.max(0, s.battery / 100));
  if (s.batteryVolts !== undefined) {
    return Math.min(1, Math.max(0, (s.batteryVolts - 3.3) / (4.2 - 3.3)));
  }
  return 1;
}

export function isProblemSensor(s: Sensor): boolean {
  if (!s.hasTelemetry) return false;
  if (s.status === 'offline') return true;
  if (isLeaking(s)) return true;
  if (s.battery > 0 && s.battery <= 20) return true;
  return false;
}

export function computeSystemHealth(
  sensors: Sensor[],
  alerts: SmartAlert[],
): SystemHealth {
  const reporting = sensors.filter((s) => s.hasTelemetry);
  const problemCount = sensors.filter(isProblemSensor).length;

  if (reporting.length === 0) {
    return {
      score: null,
      statusLine: 'Standby — awaiting telemetry',
      problemCount: 0,
      color: colors.textFaint,
      bandLabel: 'STANDBY',
    };
  }

  // Connectivity (50)
  const onlineCount = reporting.filter((s) => s.status !== 'offline').length;
  const connectivityPts = (onlineCount / reporting.length) * 50;

  // Alerts (30)
  let alertDeduction = 0;
  for (const a of alerts) {
    if (a.level === 'danger') alertDeduction += 12;
    else if (a.level === 'warning') alertDeduction += 6;
    else alertDeduction += 2;
  }
  const alertPts = Math.max(0, 30 - alertDeduction);

  // Battery fleet (20)
  const avgBattery =
    reporting.reduce((sum, s) => sum + batteryFraction(s), 0) / reporting.length;
  const batteryPts = avgBattery * 20;

  const score = Math.round(
    Math.min(100, Math.max(0, connectivityPts + alertPts + batteryPts)),
  );

  const color =
    score >= 80 ? colors.online : score >= 50 ? colors.warning : colors.danger;
  const bandLabel = score >= 80 ? 'HEALTHY' : score >= 50 ? 'DEGRADED' : 'CRITICAL';

  const statusLine =
    problemCount === 0
      ? 'All systems nominal'
      : `${problemCount} sensor${problemCount === 1 ? '' : 's'} need${
          problemCount === 1 ? 's' : ''
        } attention`;

  return { score, statusLine, problemCount, color, bandLabel };
}
