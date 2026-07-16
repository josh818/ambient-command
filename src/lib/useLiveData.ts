import { useEffect, useRef, useState } from 'react';
import type { Sensor } from './mockData';
import { getModuleListing, type ModuleRecord } from './api';

// LIVE DATA POLICY — ZERO fabricated data.
// This hook fetches real telemetry from the server (GetModuleListing) and
// merges it onto the roster. If the server cannot be reached, sensors keep
// hasTelemetry: false and every reading displays as N/A. Nothing is ever
// simulated or randomized. Once a real value has been received it is kept
// (latched) even if a later poll fails.

function num(v: unknown): number | undefined {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
  return undefined;
}

function parseDate(v: unknown): number | undefined {
  if (typeof v !== 'string' || !v) return undefined;
  const t = Date.parse(v);
  return Number.isNaN(t) ? undefined : t;
}

interface LiveTelemetry {
  leak?: number;
  valveOpen?: boolean;
  batteryVolts?: number;
  systemVolts?: number;
  lastUpdate?: number;
  unitName?: string;
  locationName?: string;
}

function extractTelemetry(rec: ModuleRecord): LiveTelemetry {
  const t: LiveTelemetry = {};
  const leak = num(rec['esp_meas_leak_detected'] ?? rec['leak_detected']);
  if (leak !== undefined) t.leak = leak;
  const valve = num(rec['esp_meas_valve_state'] ?? rec['valve_state']);
  if (valve !== undefined) t.valveOpen = valve > 0;
  const batt = num(rec['esp_meas_batchrg_volts_dbl']);
  if (batt !== undefined) t.batteryVolts = batt;
  const sys = num(rec['esp_meas_sys_volts_dbl']);
  if (sys !== undefined) t.systemVolts = sys;
  const ts = parseDate(rec['rec_date_time']);
  if (ts !== undefined) t.lastUpdate = ts;
  const unitName = rec['unit_name'];
  if (typeof unitName === 'string' && unitName.trim()) t.unitName = unitName.trim();
  const locationName = rec['location_name'];
  if (typeof locationName === 'string' && locationName.trim()) t.locationName = locationName.trim();
  return t;
}

export function useLiveData(sensors: Sensor[], intervalMs = 15000) {
  const [telemetry, setTelemetry] = useState<Record<string, LiveTelemetry>>({});
  const [pulse, setPulse] = useState(false);
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);
  const latched = useRef<Record<string, LiveTelemetry>>({});

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const records = await getModuleListing();
        if (cancelled) return;
        const next = { ...latched.current };
        records.forEach((rec) => {
          const id = String(rec['module_id'] ?? '');
          if (!id) return;
          // Latch: merge new real values over previously received ones.
          next[id] = { ...next[id], ...extractTelemetry(rec) };
        });
        latched.current = next;
        setTelemetry(next);
        setServerOnline(true);
        setPulse(true);
        setTimeout(() => {
          if (!cancelled) setPulse(false);
        }, 600);
      } catch {
        if (!cancelled) setServerOnline(false);
        // Keep any previously latched real values; never invent replacements.
      }
    };

    void poll();
    const idInt = setInterval(() => void poll(), intervalMs);
    return () => {
      cancelled = true;
      clearInterval(idInt);
    };
  }, [intervalMs]);

  const liveSensors: Sensor[] = sensors.map((s) => {
    const t = telemetry[s.id];
    if (!t) return s; // no server data ever received → stays N/A
    const hasReading = t.leak !== undefined || t.valveOpen !== undefined;
    return {
      ...s,
      hasTelemetry: hasReading,
      value: t.leak ?? s.value,
      isOn: t.valveOpen ?? s.isOn,
      batteryVolts: t.batteryVolts,
      systemVolts: t.systemVolts,
      lastUpdate: t.lastUpdate ?? s.lastUpdate,
      status: hasReading ? (t.leak && t.leak > 0 ? 'warning' : 'online') : s.status,
    };
  });

  return { liveSensors, pulse, serverOnline };
}
