import { useEffect, useMemo, useState } from 'react';
import { getModuleMeasurements, toDateParam } from './api';
import { buildSeriesFromMeasurements, rangeMeta, type HistorySeries, type TimeRange } from './history';
import type { Sensor } from './mockData';

// Water-usage analytics built ONLY from the server's GetModuleMeasments
// endpoint (same source sparkHistory uses), fetched over longer windows.
//
// DATA POLICY: nothing is simulated. If the server is unreachable or has no
// records for a window, consumers get null / hasData:false and the UI shows
// an explicit "Awaiting telemetry" state — never fake numbers.
//
// DEVICE SCOPING: callers pass the sensor list from useSensors(), which is
// already filtered per-account by useDeviceAccess. Only those module ids are
// ever queried here.

const CACHE_TTL_MS = 5 * 60 * 1000;

// For trend comparison we fetch DOUBLE the window (current + prior period)
// in a single request per module, then split by timestamp.
const MAX_COUNT: Record<TimeRange, number> = { '24h': 400, '7d': 1200, '30d': 2400 };

type CacheEntry = { series: HistorySeries | null; fetchedAt: number };
const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<HistorySeries | null>>();

async function fetchWindow(sensorId: string, range: TimeRange): Promise<HistorySeries | null> {
  const days = rangeMeta[range].days;
  const to = new Date();
  const from = new Date(to.getTime() - 2 * days * 24 * 60 * 60 * 1000);
  try {
    const records = await getModuleMeasurements(
      sensorId,
      toDateParam(from),
      toDateParam(to),
      MAX_COUNT[range],
    );
    return buildSeriesFromMeasurements(records, range);
  } catch {
    return null; // unreachable server → no data, never fabricated
  }
}

function fetchCached(sensorId: string, range: TimeRange): Promise<HistorySeries | null> {
  const key = `${sensorId}:${range}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return Promise.resolve(cached.series);
  }
  let promise = inFlight.get(key);
  if (!promise) {
    promise = fetchWindow(sensorId, range).then((series) => {
      cache.set(key, { series, fetchedAt: Date.now() });
      inFlight.delete(key);
      return series;
    });
    inFlight.set(key, promise);
  }
  return promise;
}

/** Map of sensorId → series (undefined = loading, null = no real data). */
export function useUsageSeries(
  sensorIds: string[],
  range: TimeRange,
): { seriesById: Record<string, HistorySeries | null | undefined>; loading: boolean } {
  const [seriesById, setSeriesById] = useState<Record<string, HistorySeries | null | undefined>>({});
  const idsKey = sensorIds.join(',');

  useEffect(() => {
    let cancelled = false;
    // Seed synchronously from cache; unknown ids start as loading.
    const seed: Record<string, HistorySeries | null | undefined> = {};
    for (const id of sensorIds) {
      const cached = cache.get(`${id}:${range}`);
      seed[id] =
        cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS ? cached.series : undefined;
    }
    setSeriesById(seed);
    for (const id of sensorIds) {
      if (seed[id] !== undefined) continue;
      void fetchCached(id, range).then((series) => {
        if (!cancelled) setSeriesById((prev) => ({ ...prev, [id]: series }));
      });
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, range]);

  const loading = sensorIds.some((id) => seriesById[id] === undefined);
  return { seriesById, loading };
}

// ── Aggregation ──────────────────────────────────────────────────────────────

export interface UsageBucket {
  start: number; // epoch ms
  label: string;
  value: number;
}

export interface SensorUsage {
  sensorId: string;
  name: string;
  location: string;
  total: number;
  prevTotal: number;
  hasData: boolean;
}

export interface UsageSummary {
  buckets: UsageBucket[];
  total: number;
  prevTotal: number;
  /** % change vs the prior period, or null when the prior period had no data. */
  changePct: number | null;
  avgPerBucket: number;
  peak: UsageBucket | null;
  minNonEmpty: UsageBucket | null;
  perSensor: SensorUsage[];
  busiest: SensorUsage | null;
  metricLabel: string;
  metricUnit: string;
  /** True only when at least one REAL measurement fell inside the window. */
  hasData: boolean;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function hourLabel(d: Date): string {
  const h = d.getHours();
  if (h === 0) return '12a';
  if (h === 12) return '12p';
  return h < 12 ? `${h}a` : `${h - 12}p`;
}

function dayLabel(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/**
 * Aggregate real measurement series into usage buckets (hourly for 24h,
 * daily for 7d/30d), with prior-period totals for the trend arrow.
 * Pure — pass the device-access-filtered sensor list.
 */
export function aggregateUsage(
  sensors: Sensor[],
  seriesById: Record<string, HistorySeries | null | undefined>,
  range: TimeRange,
  scopeSensorId: string | null = null,
  now: number = Date.now(),
): UsageSummary {
  const days = rangeMeta[range].days;
  const hourly = range === '24h';
  const bucketMs = hourly ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const bucketCount = hourly ? 24 : days;

  // Align the last bucket to the current hour / today.
  const anchor = new Date(now);
  anchor.setMinutes(0, 0, 0);
  if (!hourly) anchor.setHours(0, 0, 0, 0);
  const lastBucketStart = anchor.getTime();
  const windowStart = lastBucketStart - (bucketCount - 1) * bucketMs;
  const prevStart = windowStart - bucketCount * bucketMs;

  const buckets: UsageBucket[] = Array.from({ length: bucketCount }, (_, i) => {
    const start = windowStart + i * bucketMs;
    const d = new Date(start);
    return { start, label: hourly ? hourLabel(d) : dayLabel(d), value: 0 };
  });

  const scoped = scopeSensorId ? sensors.filter((s) => s.id === scopeSensorId) : sensors;

  let metricLabel = '';
  let metricUnit = '';
  let total = 0;
  let prevTotal = 0;
  let hasData = false;
  const perSensor: SensorUsage[] = [];

  for (const s of scoped) {
    const series = seriesById[s.id];
    let sTotal = 0;
    let sPrev = 0;
    let sHas = false;
    if (series && series.points.length > 0) {
      if (!metricLabel) {
        metricLabel = series.metricLabel;
        metricUnit = series.metricUnit;
      }
      for (const p of series.points) {
        if (p.t >= windowStart) {
          const idx = Math.min(bucketCount - 1, Math.floor((p.t - windowStart) / bucketMs));
          if (idx >= 0) {
            buckets[idx].value = round2(buckets[idx].value + p.value);
            sTotal += p.value;
            sHas = true;
          }
        } else if (p.t >= prevStart) {
          sPrev += p.value;
        }
      }
    }
    total += sTotal;
    prevTotal += sPrev;
    if (sHas) hasData = true;
    perSensor.push({
      sensorId: s.id,
      name: s.defaultName,
      location: s.location,
      total: round2(sTotal),
      prevTotal: round2(sPrev),
      hasData: sHas,
    });
  }

  total = round2(total);
  prevTotal = round2(prevTotal);

  const nonEmpty = buckets.filter((b) => b.value > 0);
  const peak = nonEmpty.length
    ? nonEmpty.reduce((a, b) => (b.value > a.value ? b : a))
    : null;
  const minNonEmpty = nonEmpty.length
    ? nonEmpty.reduce((a, b) => (b.value < a.value ? b : a))
    : null;
  const withData = perSensor.filter((p) => p.hasData);
  const busiest = withData.length
    ? withData.reduce((a, b) => (b.total > a.total ? b : a))
    : null;

  return {
    buckets,
    total,
    prevTotal,
    changePct:
      prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 1000) / 10 : null,
    avgPerBucket: round2(total / bucketCount),
    peak,
    minNonEmpty,
    perSensor,
    busiest,
    metricLabel,
    metricUnit,
    hasData,
  };
}

/** Convenience hook: fetch + aggregate in one step. */
export function useUsageAnalytics(
  sensors: Sensor[],
  range: TimeRange,
  scopeSensorId: string | null = null,
): { summary: UsageSummary; loading: boolean } {
  const ids = useMemo(() => sensors.map((s) => s.id), [sensors]);
  const { seriesById, loading } = useUsageSeries(ids, range);
  const summary = useMemo(
    () => aggregateUsage(sensors, seriesById, range, scopeSensorId),
    [sensors, seriesById, range, scopeSensorId],
  );
  return { summary, loading };
}

/**
 * Month-to-date fleet usage from real measurements (reuses the 30d cache).
 * Used by the conservation-goal card.
 */
export function useMonthToDateUsage(sensors: Sensor[]): {
  total: number;
  metricLabel: string;
  metricUnit: string;
  hasData: boolean;
  loading: boolean;
} {
  const ids = useMemo(() => sensors.map((s) => s.id), [sensors]);
  const { seriesById, loading } = useUsageSeries(ids, '30d');
  return useMemo(() => {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const startMs = monthStart.getTime();
    let total = 0;
    let hasData = false;
    let metricLabel = '';
    let metricUnit = '';
    for (const id of ids) {
      const series = seriesById[id];
      if (!series) continue;
      if (!metricLabel) {
        metricLabel = series.metricLabel;
        metricUnit = series.metricUnit;
      }
      for (const p of series.points) {
        if (p.t >= startMs) {
          total += p.value;
          hasData = true;
        }
      }
    }
    return { total: round2(total), metricLabel, metricUnit, hasData, loading };
  }, [ids, seriesById, loading]);
}
