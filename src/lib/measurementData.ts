import { useEffect, useMemo, useState } from 'react';
import {
  getModuleListing,
  getModuleMeasurements,
  toDateParam,
  type ModuleRecord,
} from './api';

// Rich per-sensor "Data Points" built ONLY from the server's
// GetModuleMeasments endpoint (raw parsed records, not a single charted
// metric like sparkHistory). One 30-day fetch per module is cached and
// sliced client-side for the 24h / 7d / 30d windows.
//
// DATA POLICY: nothing is simulated. If the server is unreachable or a
// module has no records in the window, consumers get hasData:false and the
// UI shows an explicit "Awaiting telemetry" state — never fake numbers.
//
// DEVICE SCOPING: this hook is only ever called with module ids that came
// from useSensors(), which is already filtered per-account by
// useDeviceAccess. No unassigned module is ever queried here.

export const WINDOW_24H_MS = 24 * 60 * 60 * 1000;
export const WINDOW_7D_MS = 7 * 24 * 60 * 60 * 1000;
export const WINDOW_30D_MS = 30 * 24 * 60 * 60 * 1000;

const CACHE_TTL_MS = 5 * 60 * 1000;
const FETCH_WINDOW_MS = WINDOW_30D_MS;
const MAX_COUNT = 4000;

/** One parsed measurement record (raw server row kept alongside). */
export interface MeasurementRecord {
  t: number; // epoch ms parsed from rec_date_time
  flowFreq: number | null; // esp_meas_flow_freq (Hz)
  pressureFreq: number | null; // esp_meas_pressure_freq (Hz)
  pressureSwitchStart: boolean | null; // esp_meas_pressure_switch_start — true = OPEN (1), false = CLOSED (0)
  temperatureC: number | null; // esp_meas_temperature (°C)
  batteryVolts: number | null; // esp_meas_batchrg_volts_dbl ?? esp_meas_sys_volts_dbl
  sysVolts: number | null; // esp_meas_sys_volts_dbl (battery volts)
  sysAmps: number | null; // esp_meas_sys_amps_dbl (battery amps)
  chargeVolts: number | null; // esp_meas_batchrg_volts_dbl (charge volts)
  chargeAmps: number | null; // esp_meas_batchrg_amps_dbl (charge amps)
  valveState: number | null; // esp_meas_valve_state — 1 = OPEN, 0 = CLOSED (vendor-confirmed)
  valveMode: string | null; // valve_mode
  leakDetected: boolean; // esp_meas_leak_detected === 1
  leakSource: string | null; // esp_meas_leak_source
  raw: ModuleRecord;
}

export interface FlushStats {
  count: number;
  /** Duration (sec) spanned by the most recent flush's records, or null when none. */
  lastDurationSec: number | null;
  /** How many records made up the most recent flush (1 → show "~1 reading"). */
  lastRunRecords: number;
  avgDurationSec: number | null;
}

export interface DerivedMeasurements {
  /** True only when at least one REAL record fell inside the window. */
  hasData: boolean;
  flowRateHz: number | null;
  flushes: FlushStats;
  pressure: { freqHz: number | null; switchOpen: boolean | null };
  temperatureC: number | null;
  batteryVolts: number | null;
  valveOpen: boolean | null; // valve_state 1 = open, 0 = closed (vendor-confirmed)
  valveMode: string | null;
  alarmEvents: { count: number; lastAt: number | null; lastSource: string | null };
  shutoffs: number; // valve_state transitions 1 → 0 (open → closed) in the window
  valveResets: number; // valve_state transitions 0 → 1 (closed → open) in the window
  /** The hardware does not report conductivity — always null, never faked. */
  conductivity: null;
}

// ── Parsing ─────────────────────────────────────────────────────────────────

function toNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

function toStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function parseTimestamp(raw: unknown): number | null {
  if (typeof raw === 'number' && raw > 0) return raw > 1e12 ? raw : raw * 1000;
  if (typeof raw === 'string' && raw.trim()) {
    const normalized = raw.replace(/\//g, '-').replace(' ', 'T');
    const ms = Date.parse(normalized);
    if (!Number.isNaN(ms)) return ms;
    const ms2 = Date.parse(raw);
    if (!Number.isNaN(ms2)) return ms2;
  }
  return null;
}

function parseRecord(rec: ModuleRecord): MeasurementRecord | null {
  const t = parseTimestamp(rec['rec_date_time']);
  if (t === null) return null;
  const pressSwitch = toNum(rec['esp_meas_pressure_switch_start']);
  const batChrg = toNum(rec['esp_meas_batchrg_volts_dbl']);
  const sysVolts = toNum(rec['esp_meas_sys_volts_dbl']);
  return {
    t,
    flowFreq: toNum(rec['esp_meas_flow_freq']),
    pressureFreq: toNum(rec['esp_meas_pressure_freq']),
    pressureSwitchStart: pressSwitch === null ? null : pressSwitch === 1,
    temperatureC: toNum(rec['esp_meas_temperature']),
    batteryVolts: batChrg ?? sysVolts,
    sysVolts,
    sysAmps: toNum(rec['esp_meas_sys_amps_dbl']),
    chargeVolts: batChrg,
    chargeAmps: toNum(rec['esp_meas_batchrg_amps_dbl']),
    valveState: toNum(rec['esp_meas_valve_state']),
    valveMode: toStr(rec['valve_mode']),
    leakDetected: toNum(rec['esp_meas_leak_detected']) === 1,
    leakSource: toStr(rec['esp_meas_leak_source']),
    raw: rec,
  };
}

/** Parse + sort ascending by timestamp. Exported for testability. */
export function parseMeasurements(records: ModuleRecord[]): MeasurementRecord[] {
  const parsed: MeasurementRecord[] = [];
  for (const rec of records) {
    const p = parseRecord(rec);
    if (p) parsed.push(p);
  }
  parsed.sort((a, b) => a.t - b.t);
  return parsed;
}

// ── Derivation (pure) ───────────────────────────────────────────────────────

function deriveFlushes(records: MeasurementRecord[]): FlushStats {
  // A "flush" = a contiguous run of records with flow_freq > 0.
  const runs: { start: number; end: number; count: number }[] = [];
  let current: { start: number; end: number; count: number } | null = null;
  for (const r of records) {
    const flowing = (r.flowFreq ?? 0) > 0;
    if (flowing) {
      if (current) {
        current.end = r.t;
        current.count += 1;
      } else {
        current = { start: r.t, end: r.t, count: 1 };
      }
    } else if (current) {
      runs.push(current);
      current = null;
    }
  }
  if (current) runs.push(current);

  if (runs.length === 0) {
    return { count: 0, lastDurationSec: null, lastRunRecords: 0, avgDurationSec: null };
  }
  const durations = runs.map((run) => Math.max(0, Math.round((run.end - run.start) / 1000)));
  const last = runs[runs.length - 1];
  return {
    count: runs.length,
    lastDurationSec: durations[durations.length - 1],
    lastRunRecords: last.count,
    avgDurationSec: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
  };
}

/** Compute all derived data points from window-scoped records (ascending). */
export function deriveMeasurements(records: MeasurementRecord[]): DerivedMeasurements {
  const latest = records.length > 0 ? records[records.length - 1] : null;

  let shutoffs = 0;
  let valveResets = 0;
  let prevValve: number | null = null;
  let alarmCount = 0;
  let lastAlarmAt: number | null = null;
  let lastAlarmSource: string | null = null;

  for (const r of records) {
    if (r.valveState !== null) {
      if (prevValve !== null && prevValve !== r.valveState) {
        // Polarity (vendor-confirmed): 1 = OPEN, 0 = CLOSED.
        if (prevValve === 1 && r.valveState === 0) shutoffs += 1; // open → closed
        else if (prevValve === 0 && r.valveState === 1) valveResets += 1; // closed → open
      }
      prevValve = r.valveState;
    }
    if (r.leakDetected) {
      alarmCount += 1;
      lastAlarmAt = r.t; // records are ascending → last one wins
      lastAlarmSource = r.leakSource;
    }
  }

  return {
    hasData: records.length > 0,
    flowRateHz: latest?.flowFreq ?? null,
    flushes: deriveFlushes(records),
    pressure: {
      freqHz: latest?.pressureFreq ?? null,
      switchOpen: latest?.pressureSwitchStart ?? null,
    },
    temperatureC: latest?.temperatureC ?? null,
    batteryVolts: latest?.batteryVolts ?? null,
    valveOpen: latest && latest.valveState !== null ? latest.valveState === 1 : null,
    valveMode: latest?.valveMode ?? null,
    alarmEvents: { count: alarmCount, lastAt: lastAlarmAt, lastSource: lastAlarmSource },
    shutoffs,
    valveResets,
    conductivity: null, // hardware doesn't report it — shown honestly as "Not reported"
  };
}

// ── Downsampling (pure — used by the trends charts) ─────────────────────────

export interface TrendPoint {
  t: number; // epoch ms
  value: number;
}

/**
 * How a time bucket collapses to one point:
 * - 'mean' — analog values (volts, amps, Hz, °C)
 * - 'max'  — event-ish flags (leak) so a single hit inside a bucket survives
 * - 'last' — step signals (valve state, pressure switch) so the bucket ends
 *   in the state the hardware was actually in
 */
export type BucketMode = 'mean' | 'max' | 'last';

/** Pull one numeric series out of parsed records, skipping nulls. */
export function extractSeries(
  records: MeasurementRecord[],
  pick: (r: MeasurementRecord) => number | null,
): TrendPoint[] {
  const out: TrendPoint[] = [];
  for (const r of records) {
    const v = pick(r);
    if (v !== null && Number.isFinite(v)) out.push({ t: r.t, value: v });
  }
  return out;
}

/**
 * Bucket an ascending series down to ≤ maxPoints time buckets. Pure — never
 * invents points: every output point is a real record ('max'/'last') or the
 * mean of real records in the bucket ('mean'). Series already at or under
 * the cap pass through unchanged.
 */
export function downsampleSeries(
  points: TrendPoint[],
  maxPoints = 200,
  mode: BucketMode = 'mean',
): TrendPoint[] {
  if (points.length <= maxPoints || maxPoints < 1) return points;
  const t0 = points[0].t;
  const span = points[points.length - 1].t - t0;
  if (span <= 0) return [points[points.length - 1]];
  const bucketMs = span / maxPoints;

  const out: TrendPoint[] = [];
  let bucket: TrendPoint[] = [];
  let curBucket = -1;
  const flush = () => {
    if (bucket.length === 0) return;
    if (mode === 'last') {
      out.push(bucket[bucket.length - 1]);
    } else if (mode === 'max') {
      let best = bucket[0];
      for (const p of bucket) if (p.value > best.value) best = p;
      out.push(best);
    } else {
      let sumT = 0;
      let sumV = 0;
      for (const p of bucket) {
        sumT += p.t;
        sumV += p.value;
      }
      out.push({ t: sumT / bucket.length, value: sumV / bucket.length });
    }
    bucket = [];
  };
  for (const p of points) {
    const bi = Math.min(maxPoints - 1, Math.floor((p.t - t0) / bucketMs));
    if (bi !== curBucket) {
      flush();
      curBucket = bi;
    }
    bucket.push(p);
  }
  flush();
  return out;
}

// ── Fetch + cache (mirrors sparkHistory's pattern) ──────────────────────────

type FetchResult = {
  records: MeasurementRecord[];
  /** True when the server returned exactly max_count rows — the window may
   * be missing older records. Never hidden from the UI. */
  truncated: boolean;
};
type CacheEntry = { result: FetchResult | null; fetchedAt: number };
const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<FetchResult | null>>();

async function fetchThirtyDays(moduleId: string): Promise<FetchResult | null> {
  const to = new Date();
  const from = new Date(to.getTime() - FETCH_WINDOW_MS);
  try {
    const raw = await getModuleMeasurements(
      moduleId,
      toDateParam(from),
      toDateParam(to),
      MAX_COUNT,
    );
    return { records: parseMeasurements(raw), truncated: raw.length >= MAX_COUNT };
  } catch {
    return null; // unreachable server → no data, never fabricated
  }
}

function fetchCached(moduleId: string): Promise<FetchResult | null> {
  const cached = cache.get(moduleId);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return Promise.resolve(cached.result);
  }
  let promise = inFlight.get(moduleId);
  if (!promise) {
    promise = fetchThirtyDays(moduleId).then((result) => {
      cache.set(moduleId, { result, fetchedAt: Date.now() });
      inFlight.delete(moduleId);
      return result;
    });
    inFlight.set(moduleId, promise);
  }
  return promise;
}

export interface MeasurementData {
  loading: boolean;
  /** Most recent record inside the window, or null. */
  latest: MeasurementRecord | null;
  /** Records inside the window, ascending by time. */
  records: MeasurementRecord[];
  derived: DerivedMeasurements;
  /**
   * True when the server capped the fetch at max_count AND the oldest
   * fetched record falls inside this window — i.e. the slice below shows
   * only the most recent records, not full window coverage.
   */
  truncated: boolean;
}

/**
 * Raw measurement records + derived data points for one module over a
 * trailing window (use WINDOW_24H_MS / WINDOW_7D_MS / WINDOW_30D_MS). One
 * 30d fetch per module (max_count 4000) is cached (5 min TTL) and deduped,
 * then sliced per window — so the list strip, the detail grid and the
 * trends screen share a single request per module.
 */
export function useMeasurementData(
  moduleId: string | undefined,
  windowMs: number,
): MeasurementData {
  const key = moduleId ?? '';
  const cached = cache.get(key);
  const fresh = cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS;
  // undefined = loading · null = fetch failed · {records: []} = no records
  const [all, setAll] = useState<FetchResult | null | undefined>(
    fresh ? cached.result : undefined,
  );

  useEffect(() => {
    if (!key || fresh) return;
    let cancelled = false;
    void fetchCached(key).then((result) => {
      if (!cancelled) setAll(result);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const { records, truncated } = useMemo(() => {
    if (!all || all.records.length === 0) return { records: [], truncated: false };
    const cutoff = Date.now() - windowMs;
    return {
      records: all.records.filter((r) => r.t >= cutoff),
      // Honesty flag: the fetch hit max_count and its oldest record is
      // inside this window → older in-window records were dropped upstream.
      truncated: all.truncated && all.records[0].t >= cutoff,
    };
  }, [all, windowMs]);

  const derived = useMemo(() => deriveMeasurements(records), [records]);

  return {
    loading: !!key && all === undefined,
    latest: records.length > 0 ? records[records.length - 1] : null,
    records,
    derived,
    truncated,
  };
}

// ── Module listing (location fields) ────────────────────────────────────────
// The measurement records don't carry location — that lives on the module
// listing record (location_name, location_city, location_state, …). Cached
// once for the whole app.

export interface ModuleLocation {
  name: string | null; // location_name
  city: string | null; // location_city
  state: string | null; // location_state
  unitName: string | null; // unit_name
}

type ListingEntry = { byId: Map<string, ModuleLocation>; fetchedAt: number };
let listingCache: ListingEntry | null = null;
let listingInFlight: Promise<Map<string, ModuleLocation>> | null = null;

async function fetchListing(): Promise<Map<string, ModuleLocation>> {
  const byId = new Map<string, ModuleLocation>();
  try {
    const rows = await getModuleListing();
    for (const row of rows) {
      const id = toStr(row['module_id']);
      if (!id) continue;
      byId.set(id, {
        name: toStr(row['location_name']),
        city: toStr(row['location_city']),
        state: toStr(row['location_state']),
        unitName: toStr(row['unit_name']),
      });
    }
  } catch {
    // unreachable → empty map; consumers show nothing rather than faking it
  }
  return byId;
}

function fetchListingCached(): Promise<Map<string, ModuleLocation>> {
  if (listingCache && Date.now() - listingCache.fetchedAt < CACHE_TTL_MS) {
    return Promise.resolve(listingCache.byId);
  }
  if (!listingInFlight) {
    listingInFlight = fetchListing().then((byId) => {
      listingCache = { byId, fetchedAt: Date.now() };
      listingInFlight = null;
      return byId;
    });
  }
  return listingInFlight;
}

/** Location fields for a module from GetModuleListing (null while loading / unknown). */
export function useModuleLocation(moduleId: string | undefined): ModuleLocation | null {
  const key = moduleId ?? '';
  const fresh = listingCache && Date.now() - listingCache.fetchedAt < CACHE_TTL_MS;
  const [loc, setLoc] = useState<ModuleLocation | null>(
    fresh ? (listingCache!.byId.get(key) ?? null) : null,
  );

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    void fetchListingCached().then((byId) => {
      if (!cancelled) setLoc(byId.get(key) ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return loc;
}
