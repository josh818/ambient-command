import { useEffect, useState } from 'react';
import { getModuleMeasurements, toDateParam } from './api';
import { buildSeriesFromMeasurements, type HistorySeries } from './history';

// Shared last-24h measurement series per sensor, used for list-card
// sparklines and the detail screen's stat tiles.
//
// DATA POLICY: values come ONLY from the server's GetModuleMeasments
// endpoint. If the server has no records (or is unreachable) consumers get
// null — nothing is simulated.
//
// Results are cached module-wide for a few minutes so scrolling the list or
// remounting cards doesn't hammer the server with one request per card.

const CACHE_TTL_MS = 5 * 60 * 1000;
const SPARK_POINTS = 20;

type CacheEntry = { series: HistorySeries | null; fetchedAt: number };
const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<HistorySeries | null>>();

function downsample(values: number[], target: number): number[] {
  if (values.length <= target) return values;
  const out: number[] = [];
  for (let i = 0; i < target; i++) {
    const idx = Math.round((i / (target - 1)) * (values.length - 1));
    out.push(values[idx]);
  }
  return out;
}

async function fetchDaySeries(sensorId: string): Promise<HistorySeries | null> {
  const to = new Date();
  const from = new Date(to.getTime() - 24 * 60 * 60 * 1000);
  try {
    const records = await getModuleMeasurements(
      sensorId,
      toDateParam(from),
      toDateParam(to),
      200,
    );
    return buildSeriesFromMeasurements(records, '24h');
  } catch {
    return null; // unreachable server → no data, never fake it
  }
}

/**
 * Last-24h measurement series for a sensor from the live server, or null
 * while loading / when no real data exists. Cached + deduped module-wide.
 */
export function useDaySeries(sensorId: string | undefined): HistorySeries | null {
  const key = sensorId ?? '';
  const cached = cache.get(key);
  const fresh = cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS;
  const [series, setSeries] = useState<HistorySeries | null>(
    fresh ? cached.series : null,
  );

  useEffect(() => {
    if (!key || fresh) return;
    let cancelled = false;

    let promise = inFlight.get(key);
    if (!promise) {
      promise = fetchDaySeries(key).then((result) => {
        cache.set(key, { series: result, fetchedAt: Date.now() });
        inFlight.delete(key);
        return result;
      });
      inFlight.set(key, promise);
    }

    promise.then((result) => {
      if (!cancelled) setSeries(result);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return series;
}

/**
 * Returns the last-24h sparkline values for a sensor (≤20 points), or null
 * while loading / when no real data exists.
 */
export function useSparkline(sensorId: string): number[] | null {
  const series = useDaySeries(sensorId);
  if (!series || series.points.length < 2) return null;
  return downsample(
    series.points.map((p) => p.value),
    SPARK_POINTS,
  );
}
