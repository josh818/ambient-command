import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/theme';
import { getModule, type ModuleRecord } from '../lib/api';

// Friendly labels for known server columns. Unknown keys fall back to the
// raw column name so we never hide data the server sends us.
const FIELD_LABELS: Record<string, string> = {
  module_id: 'Module ID',
  rec_id: 'Record ID',
  rec_date_time: 'Recorded',
  unit_name: 'Unit Name',
  location_name: 'Location',
  location_city: 'City',
  location_state: 'State',
  location_country: 'Country',
  location_postal_code: 'Postal Code',
  location_contact_name: 'Contact',
  location_contact_ph: 'Contact Phone',
  location_contact_email: 'Contact Email',
  ssid: 'SSID',
  email: 'Email',
  mobile_phone: 'Mobile',
  notes: 'Notes',
  mac: 'MAC Address',
  esp_meas_leak_detected: 'Leak Detected',
  esp_meas_leak_source: 'Leak Source',
  esp_meas_valve_state: 'Valve State',
  esp_meas_temperature: 'Temperature',
  esp_meas_sys_volts_dbl: 'System Volts',
  esp_meas_sys_amps_dbl: 'System Amps',
  esp_meas_batchrg_volts_dbl: 'Battery Volts',
  esp_meas_batchrg_amps_dbl: 'Battery Amps',
  esp_meas_pressure_switch_start: 'Pressure Switch',
  esp_meas_flow_freq: 'Flow Frequency',
  esp_meas_pressure_freq: 'Pressure Frequency',
  esp_meas_wake_up_type: 'Wake-up Type',
  esp_meas_msmnt_idx: 'Measurement Index',
  valve_mode: 'Valve Mode',
  version: 'Firmware Version',
};

function labelFor(key: string): string {
  return FIELD_LABELS[key] ?? key;
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
}

export function LiveModuleData({ moduleId }: { moduleId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<ModuleRecord[]>([]);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getModule(moduleId);
      setRecords(data);
      setFetchedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connection failed');
    } finally {
      setLoading(false);
    }
  }, [moduleId]);

  useEffect(() => {
    void load();
  }, [load]);

  const record = records[0] ?? null;
  const entries = record
    ? Object.entries(record).filter(([, v]) => v !== null && v !== undefined && v !== '')
    : [];
  const visible = expanded ? entries : entries.slice(0, 6);

  return (
    <View
      className="rounded-2xl p-4 mt-4"
      style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center">
          <View
            className="w-10 h-10 rounded-xl items-center justify-center"
            style={{
              backgroundColor: error ? 'rgba(224,114,89,0.12)' : 'rgba(126,226,190,0.12)',
            }}
          >
            <Ionicons
              name={error ? 'cloud-offline' : 'cloud-done'}
              size={20}
              color={error ? colors.danger : colors.online}
            />
          </View>
          <View style={{ marginLeft: 12 }}>
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>
              Live Server Data
            </Text>
            <Text style={{ color: colors.textFaint, fontSize: 12, marginTop: 1 }}>
              {loading
                ? 'Fetching from API…'
                : error
                  ? 'Could not reach server'
                  : fetchedAt
                    ? `Fetched ${new Date(fetchedAt).toLocaleTimeString()}`
                    : 'GetModule endpoint'}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={() => void load()}
          disabled={loading}
          className="w-9 h-9 rounded-full items-center justify-center active:opacity-70"
          style={{ backgroundColor: colors.surfaceAlt }}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="refresh" size={18} color={colors.primary} />
          )}
        </Pressable>
      </View>

      {error ? (
        <View
          className="rounded-xl p-3 mt-3"
          style={{ backgroundColor: 'rgba(224,114,89,0.08)' }}
        >
          <Text style={{ color: colors.danger, fontSize: 12, fontWeight: '600' }}>{error}</Text>
          <Text style={{ color: colors.textFaint, fontSize: 11, marginTop: 4 }}>
            If this is a certificate warning, open the API URL directly in your browser once to
            trust it. CORS must also be enabled on the server for browser access.
          </Text>
        </View>
      ) : !loading && entries.length === 0 ? (
        <View className="rounded-xl p-3 mt-3" style={{ backgroundColor: colors.surfaceAlt }}>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>
            Server returned no data for module {moduleId}.
          </Text>
        </View>
      ) : record ? (
        <View className="mt-2">
          {records.length > 1 && (
            <Text style={{ color: colors.textFaint, fontSize: 11, marginBottom: 4 }}>
              Showing latest of {records.length} records
            </Text>
          )}
          {visible.map(([key, value]) => (
            <View
              key={key}
              className="flex-row items-center justify-between py-2.5"
              style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}
            >
              <Text style={{ color: colors.textMuted, fontSize: 13, flex: 1 }} numberOfLines={1}>
                {labelFor(key)}
              </Text>
              <Text
                style={{
                  color: colors.text,
                  fontSize: 13,
                  fontWeight: '600',
                  flex: 1,
                  textAlign: 'right',
                }}
                numberOfLines={1}
              >
                {formatValue(value)}
              </Text>
            </View>
          ))}
          {entries.length > 6 && (
            <Pressable
              onPress={() => setExpanded((v) => !v)}
              className="items-center py-2.5 active:opacity-70"
            >
              <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>
                {expanded ? 'Show less' : `Show all ${entries.length} fields`}
              </Text>
            </Pressable>
          )}
        </View>
      ) : null}
    </View>
  );
}
