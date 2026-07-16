import type { SensorStatus } from '../constants/theme';

// BH Technology ASV (Automatic Shut-off Valve) modules — water-leak-only.
//
// DATA POLICY (important):
// - The module roster below (module_id, unit_name, location_name) is taken
//   VERBATIM from the server's own GetModuleListing response — it is server
//   data, not invented.
// - NO telemetry is fabricated. Every live reading (leak state, valve state,
//   battery, signal, last update) starts as "no data" (hasTelemetry: false)
//   and displays as N/A until it is actually fetched from the server via
//   GetModule. Nothing is simulated.

export type SensorType = 'water';

export interface Sensor {
  id: string; // module_id from tbl_asv_module_provisioning_data
  defaultName: string; // unit_name (verbatim from GetModuleListing)
  type: SensorType;
  status: SensorStatus; // 'unknown' until server data arrives
  value: number; // 0 = dry, 1 = leak detected (only meaningful if hasTelemetry)
  unit: string;
  battery: number; // only meaningful if hasTelemetry
  signal: number; // only meaningful if hasTelemetry
  lastUpdate: number; // epoch ms; 0 = never received (only if hasTelemetry)
  controllable: boolean; // ASV modules have an integrated auto shut-off valve
  isOn: boolean; // valve open — only meaningful if hasTelemetry or user-set
  location: string; // location_name (verbatim from GetModuleListing)
  /** True ONLY when real values have been received from the server feed. */
  hasTelemetry: boolean;
  /** Real battery voltage from the server (esp_meas_batchrg_volts_dbl). */
  batteryVolts?: number;
  /** Real system voltage from the server (esp_meas_sys_volts_dbl). */
  systemVolts?: number;
}

export const sensorTypeMeta: Record<
  SensorType,
  { label: string; icon: string }
> = {
  water: { label: 'ASV Leak Module', icon: 'water' },
};

// Roster verbatim from GetModuleListing (7 records). All telemetry N/A
// until fetched live from the server.
function rosterEntry(id: string, unitName: string, locationName: string): Sensor {
  return {
    id,
    defaultName: unitName,
    type: 'water',
    status: 'unknown',
    value: 0,
    unit: '',
    battery: 0,
    signal: 0,
    lastUpdate: 0,
    controllable: true,
    isOn: false,
    location: locationName,
    hasTelemetry: false,
  };
}

export const mockSensors: Sensor[] = [
  rosterEntry('132062666205048', 'unit 1 rev g modified', 'Lance Palatini'),
  rosterEntry('132062666202356', 'unit 1 rev g modified', 'Aron Kain'),
  rosterEntry('132062666074512', 'Mendham Township', 'desktop new unit 4'),
  rosterEntry('132062666112508', 'office', 'new unit 1'),
  rosterEntry('132062666189884', '5 cotton MB', 'new unit 2'),
  rosterEntry('132062666137092', 'development', 'new unit 3'),
  rosterEntry('132062666230588', '19Y MB', 'new unit 5'),
];

export function formatRelativeTime(epochMs: number): string {
  if (!epochMs) return 'N/A';
  const diff = Date.now() - epochMs;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

/** True when this leak detector is currently sensing water (server data only). */
export function isLeaking(sensor: Sensor): boolean {
  return sensor.hasTelemetry && sensor.status !== 'offline' && sensor.value > 0;
}

export function formatSensorValue(sensor: Sensor): string {
  if (!sensor.hasTelemetry) return 'N/A';
  if (sensor.status === 'offline') return '—';
  return sensor.value > 0 ? 'Leak Detected' : 'Dry';
}
