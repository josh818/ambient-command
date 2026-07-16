import type { Sensor } from './mockData';
import type { ModuleRecord } from './api';

export type TimeRange = '24h' | '7d' | '30d';

export interface HistoryPoint {
  t: number; // epoch ms
  value: number;
}

export interface HistorySeries {
  range: TimeRange;
  points: HistoryPoint[];
  min: number;
  max: number;
  avg: number;
  first: number;
  last: number;
  changePct: number;
  /** Human label of the server column being charted. */
  metricLabel: string;
  metricUnit: string;
}

export const rangeMeta: Record<TimeRange, { label: string; days: number }> = {
  '24h': { label: '24H', days: 1 },
  '7d': { label: '7D', days: 7 },
  '30d': { label: '30D', days: 30 },
};

// ── Real-server measurement parsing ─────────────────────────────────────────
// DATA POLICY: history charts are built ONLY from records returned by the
// server's GetModuleMeasments endpoint. Nothing is simulated. If the server
// returns no records, the chart shows an explicit "no data" state.

function parseTimestamp(rec: ModuleRecord): number | null {
  // Find a date/time field defensively (e.g. rec_date_time).
  for (const key of Object.keys(rec)) {
    const k = key.toLowerCase();
    if (k.includes('date') || k.includes('time')) {
      const raw = rec[key];
      if (typeof raw === 'number' && raw > 0) {
        // Could be unix seconds or ms
        return raw > 1e12 ? raw : raw * 1000;
      }
      if (typeof raw === 'string' && raw.trim()) {
        const normalized = raw.replace(/\//g, '-').replace(' ', 'T');
        const ms = Date.parse(normalized);
        if (!Number.isNaN(ms)) return ms;
        const ms2 = Date.parse(raw);
        if (!Number.isNaN(ms2)) return ms2;
      }
    }
  }
  return null;
}

// Preference-ordered metric candidates (matched by substring on the
// lowercase column name). First match with numeric data wins.
const METRIC_CANDIDATES: { match: string[]; label: string; unit: string }[] = [
  { match: ['leak', 'moist', 'water'], label: 'Leak / Moisture Reading', unit: '' },
  { match: ['batchrg_volts', 'bat_volts', 'battery'], label: 'Battery Voltage', unit: ' V' },
  { match: ['sys_volts'], label: 'System Voltage', unit: ' V' },
  { match: ['rssi', 'signal'], label: 'Signal', unit: '' },
];

function toNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

function pickMetricKey(records: ModuleRecord[]): { key: string; label: string; unit: string } | null {
  if (records.length === 0) return null;
  const keys = Object.keys(records[0]);
  for (const cand of METRIC_CANDIDATES) {
    for (const key of keys) {
      const k = key.toLowerCase();
      if (cand.match.some((m) => k.includes(m))) {
        // Must have at least one numeric value across records
        if (records.some((r) => toNum(r[key]) !== null)) {
          return { key, label: cand.label, unit: cand.unit };
        }
      }
    }
  }
  // Fallback: first numeric, non-id, non-date column
  for (const key of keys) {
    const k = key.toLowerCase();
    if (k.includes('id') || k.includes('date') || k.includes('time')) continue;
    if (records.some((r) => toNum(r[key]) !== null)) {
      return { key, label: key, unit: '' };
    }
  }
  return null;
}

/**
 * Build a chart series from REAL server measurement records.
 * Returns null if no usable timestamped numeric data was found.
 */
export function buildSeriesFromMeasurements(
  records: ModuleRecord[],
  range: TimeRange,
): HistorySeries | null {
  if (!records || records.length === 0) return null;
  const metric = pickMetricKey(records);
  if (!metric) return null;

  const points: HistoryPoint[] = [];
  for (const rec of records) {
    const t = parseTimestamp(rec);
    const value = toNum(rec[metric.key]);
    if (t !== null && value !== null) points.push({ t, value });
  }
  if (points.length === 0) return null;
  points.sort((a, b) => a.t - b.t);

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
  const first = values[0];
  const last = values[values.length - 1];
  const changePct =
    first === 0 ? 0 : Math.round(((last - first) / Math.abs(first)) * 1000) / 10;

  return {
    range,
    points,
    min: Math.round(min * 100) / 100,
    max: Math.round(max * 100) / 100,
    avg,
    first,
    last: Math.round(last * 100) / 100,
    changePct,
    metricLabel: metric.label,
    metricUnit: metric.unit,
  };
}

export function seriesUnit(_sensor: Sensor): string {
  return '';
}
