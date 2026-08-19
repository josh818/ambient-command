import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Switch,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors } from '../../src/constants/theme';
import { useSensor } from '../../src/lib/sensorStore';
import {
  sensorTypeMeta,
  formatRelativeTime,
  formatSensorValue,
  type Sensor,
} from '../../src/lib/mockData';
import { StatusPill } from '../../src/components/StatusPill';
import { LiveModuleData } from '../../src/components/LiveModuleData';
import { useDaySeries } from '../../src/lib/sparkHistory';
import {
  useMeasurementData,
  useModuleLocation,
  WINDOW_24H_MS,
  WINDOW_7D_MS,
} from '../../src/lib/measurementData';

function StatTile({
  label,
  value,
  tint,
}: {
  label: string;
  value: string;
  tint?: string;
}) {
  return (
    <View
      className="flex-1 rounded-xl p-3"
      style={{ backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border }}
    >
      <Text style={{ color: colors.textFaint, fontSize: 10, fontWeight: '700', letterSpacing: 0.6 }}>
        {label}
      </Text>
      <Text
        numberOfLines={1}
        style={{ color: tint ?? colors.text, fontSize: 15, fontWeight: '800', marginTop: 3 }}
      >
        {value}
      </Text>
    </View>
  );
}

// ── Data Points section ─────────────────────────────────────────────────────
// 12-point telemetry grid built ONLY from real GetModuleMeasments records
// (via useMeasurementData) + location fields from GetModuleListing.

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function fmtDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ${sec % 60 ? `${sec % 60}s` : ''}`.trim();
  const hr = Math.floor(min / 60);
  return `${hr}h ${min % 60}m`;
}

function batteryTint(volts: number): string {
  if (volts > 3.7) return colors.online;
  if (volts >= 3.4) return colors.warning;
  return colors.danger;
}

function DataPointTile({
  icon,
  iconColor,
  label,
  value,
  sub,
  valueColor,
  pillBg,
  muted,
  fullWidth,
}: {
  icon: string;
  iconColor?: string;
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
  /** When set, the value renders as a color-coded pill. */
  pillBg?: string;
  muted?: boolean;
  fullWidth?: boolean;
}) {
  return (
    <View
      className="rounded-xl p-3"
      style={{
        backgroundColor: colors.surfaceAlt,
        borderWidth: 1,
        borderColor: colors.border,
        flexGrow: 1,
        flexBasis: fullWidth ? '100%' : '42%',
        opacity: muted ? 0.65 : 1,
      }}
    >
      <View className="flex-row items-center">
        <Ionicons name={icon as any} size={13} color={iconColor ?? colors.textMuted} />
        <Text
          numberOfLines={1}
          style={{
            color: colors.textFaint,
            fontSize: 10,
            fontWeight: '700',
            letterSpacing: 0.6,
            marginLeft: 5,
            flex: 1,
          }}
        >
          {label.toUpperCase()}
        </Text>
      </View>
      {pillBg ? (
        <View
          className="self-start rounded-full px-2.5 py-1"
          style={{ backgroundColor: pillBg, marginTop: 6 }}
        >
          <Text style={{ color: valueColor ?? colors.text, fontSize: 12, fontWeight: '800' }}>
            {value}
          </Text>
        </View>
      ) : (
        <Text
          numberOfLines={1}
          style={{
            color: valueColor ?? (muted ? colors.textFaint : colors.text),
            fontSize: 15,
            fontWeight: '800',
            marginTop: 6,
          }}
        >
          {value}
        </Text>
      )}
      {sub ? (
        <Text numberOfLines={1} style={{ color: colors.textFaint, fontSize: 11, marginTop: 3 }}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

function DataPointsSection({ sensor }: { sensor: Sensor }) {
  const router = useRouter();
  const [win, setWin] = useState<'24h' | '7d'>('24h');
  const windowMs = win === '24h' ? WINDOW_24H_MS : WINDOW_7D_MS;
  const { loading, derived: d, records } = useMeasurementData(sensor.id, windowMs);
  const loc = useModuleLocation(sensor.id);

  const windowLabel = win === '24h' ? 'last 24h' : 'last 7 days';

  // Tiles that don't depend on measurements — shown even with no telemetry.
  const locationTile = (
    <DataPointTile
      key="location"
      icon="location"
      label="Location"
      value={loc?.name ?? sensor.location ?? '—'}
      sub={
        [loc?.city, loc?.state].filter(Boolean).join(', ') || 'From module listing'
      }
      fullWidth
    />
  );
  const conductivityTile = (
    <DataPointTile
      key="conductivity"
      icon="flask-outline"
      label="Conductivity"
      value="Not reported"
      sub="Hardware doesn't send this yet"
      muted
    />
  );

  const flushVal =
    d.flushes.count === 0
      ? 'None'
      : d.flushes.lastRunRecords === 1
        ? '~1 reading'
        : fmtDuration(d.flushes.lastDurationSec ?? 0);
  const flushSub =
    d.flushes.count === 0
      ? `No flushes in ${windowLabel}`
      : d.flushes.avgDurationSec === 0
        ? 'Avg: ~1 reading each'
        : `Avg ${fmtDuration(d.flushes.avgDurationSec ?? 0)}`;

  const alarms = d.alarmEvents;
  const alarmTint = alarms.count > 0 ? colors.danger : colors.text;

  return (
    <View
      className="rounded-2xl mt-4"
      style={{
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 20,
      }}
    >
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center">
          <Ionicons name="grid" size={14} color={colors.primary} />
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700', marginLeft: 6 }}>
            Data Points
          </Text>
        </View>
        <View className="flex-row" style={{ gap: 8 }}>
          {(['24h', '7d'] as const).map((k) => {
            const active = win === k;
            return (
              <Pressable
                key={k}
                onPress={() => setWin(k)}
                className="rounded-full px-3 py-1 active:opacity-70"
                style={{
                  backgroundColor: active ? 'rgba(45,212,191,0.15)' : colors.surfaceAlt,
                  borderWidth: 1,
                  borderColor: active ? colors.primary : colors.border,
                }}
              >
                <Text
                  style={{
                    color: active ? colors.primary : colors.textMuted,
                    fontSize: 11,
                    fontWeight: '700',
                  }}
                >
                  {k === '24h' ? '24H' : '7D'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {loading ? (
        <View className="items-center py-8">
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={{ color: colors.textFaint, fontSize: 12, marginTop: 10 }}>
            Fetching telemetry…
          </Text>
        </View>
      ) : !d.hasData ? (
        <View>
          <View
            className="rounded-xl p-4 flex-row items-start"
            style={{ backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border }}
          >
            <Ionicons name="cloud-offline-outline" size={18} color={colors.textFaint} style={{ marginTop: 1 }} />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '700' }}>
                Awaiting telemetry
              </Text>
              <Text style={{ color: colors.textFaint, fontSize: 12, marginTop: 3, lineHeight: 17 }}>
                This sensor hasn't reported in this window.
              </Text>
            </View>
          </View>
          <View className="flex-row flex-wrap" style={{ gap: 16, marginTop: 16 }}>
            {locationTile}
            {conductivityTile}
          </View>
        </View>
      ) : (
        <View>
          <Text style={{ color: colors.textFaint, fontSize: 11, marginBottom: 12 }}>
            {records.length} records · {windowLabel} · live server data
          </Text>
          <View className="flex-row flex-wrap" style={{ gap: 16 }}>
            {/* 1 — Water Flow Rate */}
            <DataPointTile
              icon="water"
              iconColor={colors.primary}
              label="Water Flow Rate"
              value={
                d.flowRateHz === null
                  ? '—'
                  : d.flowRateHz > 0
                    ? `${round1(d.flowRateHz)} Hz`
                    : 'Idle'
              }
              valueColor={d.flowRateHz && d.flowRateHz > 0 ? colors.primary : undefined}
              sub="Flow sensor frequency"
            />
            {/* 2 — Length of Flush */}
            <DataPointTile
              icon="timer-outline"
              label="Length of Flush"
              value={flushVal}
              sub={flushSub}
            />
            {/* 3 — Number of Flushes */}
            <DataPointTile
              icon="repeat"
              label="Number of Flushes"
              value={String(d.flushes.count)}
              sub={`In ${windowLabel}`}
            />
            {/* 4 — Water Pressure */}
            <DataPointTile
              icon="speedometer-outline"
              label="Water Pressure"
              value={
                d.pressure.freqHz === null
                  ? '—'
                  : d.pressure.freqHz > 0
                    ? `${round1(d.pressure.freqHz)} Hz`
                    : 'No pressure signal'
              }
              sub={
                d.pressure.switchOpen === null
                  ? 'Switch state unknown'
                  : d.pressure.switchOpen
                    ? 'Switch: open'
                    : 'Switch: closed'
              }
            />
            {/* 5 — Conductivity (hardware doesn't report it) */}
            {conductivityTile}
            {/* 6 — Temperature */}
            <DataPointTile
              icon="thermometer-outline"
              label="Temperature"
              value={d.temperatureC === null ? '—' : `${round1(d.temperatureC)}°C`}
              sub={
                d.temperatureC === null
                  ? undefined
                  : `${round1((d.temperatureC * 9) / 5 + 32)}°F`
              }
            />
            {/* 7 — Location (full-width, from module listing) */}
            {locationTile}
            {/* 8 — Water Shut Off */}
            <DataPointTile
              icon="power"
              label="Water Shut Off"
              value={d.valveOpen === null ? '—' : d.valveOpen ? 'OPEN' : 'CLOSED'}
              valueColor={
                d.valveOpen === null
                  ? colors.textFaint
                  : d.valveOpen
                    ? colors.online
                    : colors.danger
              }
              pillBg={
                d.valveOpen === null
                  ? colors.surface
                  : d.valveOpen
                    ? 'rgba(52,211,153,0.15)'
                    : 'rgba(248,113,113,0.15)'
              }
              sub={d.valveMode ? `Mode: ${d.valveMode}` : 'Valve state from telemetry'}
            />
            {/* 9 — Alarm Events */}
            <DataPointTile
              icon={alarms.count > 0 ? 'warning' : 'shield-checkmark-outline'}
              iconColor={alarms.count > 0 ? colors.danger : colors.textMuted}
              label="Alarm Events"
              value={String(alarms.count)}
              valueColor={alarmTint}
              sub={
                alarms.count > 0 && alarms.lastAt
                  ? `Last: ${formatRelativeTime(alarms.lastAt)}${alarms.lastSource ? ` · ${alarms.lastSource}` : ''}`
                  : `None in ${windowLabel}`
              }
            />
            {/* 10 — Number of Shutoffs */}
            <DataPointTile
              icon="lock-closed-outline"
              label="Number of Shutoffs"
              value={String(d.shutoffs)}
              sub="Valve open → closed"
            />
            {/* 11 — Number of Valve Resets */}
            <DataPointTile
              icon="refresh-outline"
              label="Number of Valve Resets"
              value={String(d.valveResets)}
              sub="Valve closed → open"
            />
            {/* 12 — Battery Voltage */}
            <DataPointTile
              icon="battery-half-outline"
              iconColor={d.batteryVolts !== null ? batteryTint(d.batteryVolts) : undefined}
              label="Battery Voltage"
              value={d.batteryVolts === null ? '—' : `${d.batteryVolts.toFixed(2)} V`}
              valueColor={d.batteryVolts !== null ? batteryTint(d.batteryVolts) : undefined}
              sub={
                d.batteryVolts === null
                  ? undefined
                  : d.batteryVolts > 3.7
                    ? 'Healthy'
                    : d.batteryVolts >= 3.4
                      ? 'Getting low'
                      : 'Low — service soon'
              }
            />
          </View>

          {/* Call to action — leak detected in window */}
          {alarms.count > 0 && (
            <View
              className="rounded-xl p-4 flex-row items-center"
              style={{
                backgroundColor: 'rgba(248,113,113,0.10)',
                borderWidth: 1,
                borderColor: 'rgba(248,113,113,0.4)',
                marginTop: 16,
              }}
            >
              <Ionicons name="warning" size={20} color={colors.danger} />
              <View style={{ flex: 1, marginLeft: 10, paddingRight: 10 }}>
                <Text style={{ color: colors.danger, fontSize: 13, fontWeight: '800' }}>
                  Leak detected
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2, lineHeight: 16 }}>
                  Consider shutting off water to this line.
                </Text>
              </View>
              <Pressable
                onPress={() => router.push('/console')}
                className="rounded-xl px-3 py-2 active:opacity-80"
                style={{ backgroundColor: colors.danger }}
              >
                <Text style={{ color: colors.bg, fontSize: 12, fontWeight: '800' }}>
                  Open Console
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <View
      className="flex-row items-center justify-between py-3"
      style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}
    >
      <Text style={{ color: colors.textMuted, fontSize: 14 }}>{label}</Text>
      <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>{value}</Text>
    </View>
  );
}

export default function SensorDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { sensor, renameSensor, toggleSensor } = useSensor(id);
  const daySeries = useDaySeries(id);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);

  if (!sensor) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: colors.bg }}>
        <Text style={{ color: colors.textMuted }}>Sensor not found</Text>
      </SafeAreaView>
    );
  }

  const meta = sensorTypeMeta[sensor.type];

  const startEdit = () => {
    setDraft(sensor.defaultName);
    setEditing(true);
  };
  const saveEdit = async () => {
    if (draft.trim()) {
      setSaving(true);
      try {
        await renameSensor(sensor.id, draft);
      } finally {
        setSaving(false);
      }
    }
    setEditing(false);
  };

  const handleToggle = async (v: boolean) => {
    setToggling(true);
    try {
      await toggleSensor(sensor.id, v);
    } finally {
      setToggling(false);
    }
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.bg }} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <View className="flex-row items-center px-5 py-3">
          <Pressable
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full items-center justify-center active:opacity-70"
            style={{ backgroundColor: colors.surface }}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginLeft: 12 }}>
            Sensor Detail
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          <View
            className="rounded-2xl p-5 items-center"
            style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
          >
            <View
              className="w-16 h-16 rounded-2xl items-center justify-center mb-3"
              style={{ backgroundColor: colors.surfaceAlt }}
            >
              <Ionicons
                name={meta.icon as any}
                size={30}
                color={sensor.status === 'offline' ? colors.offline : colors.primary}
              />
            </View>

            {editing ? (
              <View className="w-full flex-row items-center mt-1">
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  autoFocus
                  placeholder="Sensor name"
                  placeholderTextColor={colors.textFaint}
                  className="flex-1 rounded-xl px-3 py-2.5"
                  style={{
                    backgroundColor: colors.surfaceAlt,
                    color: colors.text,
                    fontSize: 16,
                    borderWidth: 1,
                    borderColor: colors.primary,
                  }}
                  onSubmitEditing={saveEdit}
                  returnKeyType="done"
                />
                <Pressable
                  onPress={saveEdit}
                  disabled={saving}
                  className="ml-2 px-4 py-2.5 rounded-xl active:opacity-80"
                  style={{ backgroundColor: colors.primary, opacity: saving ? 0.7 : 1, minWidth: 64, alignItems: 'center' }}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color={colors.bg} />
                  ) : (
                    <Text style={{ color: colors.bg, fontWeight: '700' }}>Save</Text>
                  )}
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={startEdit} className="flex-row items-center active:opacity-70">
                <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>
                  {sensor.defaultName}
                </Text>
                <Ionicons name="pencil" size={16} color={colors.textMuted} style={{ marginLeft: 8 }} />
              </Pressable>
            )}

            <Text style={{ color: colors.textFaint, fontSize: 13, marginTop: 4 }}>
              {sensor.location} · {meta.label}
            </Text>
            <View className="mt-3">
              <StatusPill status={sensor.status} />
            </View>

            <Text
              style={{
                color:
                  !sensor.hasTelemetry || sensor.status === 'offline'
                    ? colors.textFaint
                    : sensor.value > 0
                      ? colors.danger
                      : colors.online,
                fontSize: 28,
                fontWeight: '800',
                marginTop: 16,
              }}
            >
              {formatSensorValue(sensor)}
            </Text>
          </View>

          <LiveModuleData moduleId={sensor.id} />

          {sensor.controllable && (
            <View
              className="rounded-2xl p-5 mt-4"
              style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-1 pr-3">
                  <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
                    Water Shut-off Valve
                  </Text>
                  <Text style={{ color: colors.textFaint, fontSize: 12, marginTop: 2 }}>
                    {sensor.isOn ? 'Set to open in this app.' : 'Set to closed in this app.'}
                  </Text>
                </View>
                {toggling ? (
                  <ActivityIndicator size="small" color={colors.primary} style={{ width: 51 }} />
                ) : (
                  <Switch
                    value={sensor.isOn}
                    onValueChange={(v) => void handleToggle(v)}
                    trackColor={{ false: colors.surfaceAlt, true: colors.primaryDark }}
                    thumbColor={sensor.isOn ? colors.primary : colors.textFaint}
                    disabled={sensor.status === 'offline'}
                  />
                )}
              </View>
              <View
                className="flex-row items-start mt-3 pt-3"
                style={{ borderTopWidth: 1, borderTopColor: colors.border }}
              >
                <Ionicons name="information-circle-outline" size={15} color={colors.textFaint} style={{ marginTop: 1 }} />
                <Text style={{ color: colors.textFaint, fontSize: 11, marginLeft: 6, flex: 1, lineHeight: 15 }}>
                  Not wired to the physical valve yet — this switch only saves a setting in the app. It does not
                  open or close the actual valve.
                </Text>
              </View>
            </View>
          )}

          {/* 24h stat tiles from real server measurements */}
          {daySeries && (
            <View
              className="rounded-2xl p-4 mt-4"
              style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
            >
              <View className="flex-row items-center mb-3">
                <Ionicons name="pulse" size={14} color={colors.primary} />
                <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600', marginLeft: 6 }}>
                  {daySeries.metricLabel} · last 24h · {daySeries.points.length} records (live)
                </Text>
              </View>
              <View className="flex-row" style={{ gap: 12 }}>
                <StatTile
                  label="CURRENT"
                  value={`${daySeries.last}${daySeries.metricUnit}`}
                  tint={colors.primary}
                />
                <StatTile label="MIN" value={`${daySeries.min}${daySeries.metricUnit}`} />
                <StatTile label="MAX" value={`${daySeries.max}${daySeries.metricUnit}`} />
                <StatTile label="AVG" value={`${daySeries.avg}${daySeries.metricUnit}`} />
              </View>
            </View>
          )}

          {/* Rich per-sensor data points from raw measurement records */}
          <DataPointsSection sensor={sensor} />

          <Pressable
            onPress={() => router.push(`/sensor/${sensor.id}/history`)}
            className="rounded-2xl p-4 mt-4 flex-row items-center justify-between active:opacity-80"
            style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
          >
            <View className="flex-row items-center">
              <View
                className="w-10 h-10 rounded-xl items-center justify-center"
                style={{ backgroundColor: 'rgba(45,212,191,0.12)' }}
              >
                <Ionicons name="stats-chart" size={20} color={colors.primary} />
              </View>
              <View style={{ marginLeft: 12 }}>
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>
                  History & Trends
                </Text>
                <Text style={{ color: colors.textFaint, fontSize: 12, marginTop: 1 }}>
                  View charts over time
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </Pressable>

          <Pressable
            onPress={() => router.push(`/sensor/${sensor.id}/config`)}
            className="rounded-2xl p-4 mt-4 flex-row items-center justify-between active:opacity-80"
            style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
          >
            <View className="flex-row items-center">
              <View
                className="w-10 h-10 rounded-xl items-center justify-center"
                style={{ backgroundColor: 'rgba(129,140,248,0.12)' }}
              >
                <Ionicons name="options" size={20} color={colors.accent} />
              </View>
              <View style={{ marginLeft: 12 }}>
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>
                  Remote Configuration
                </Text>
                <Text style={{ color: colors.textFaint, fontSize: 12, marginTop: 1 }}>
                  Adjust intervals, thresholds & alerts
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </Pressable>

          <View
            className="rounded-2xl px-5 py-1 mt-4"
            style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
          >
            <MetricRow label="Device ID" value={sensor.id} />
            <MetricRow
              label="Battery volts"
              value={sensor.batteryVolts !== undefined ? `${sensor.batteryVolts.toFixed(2)}V` : 'N/A'}
            />
            <MetricRow
              label="System volts"
              value={sensor.systemVolts !== undefined ? `${sensor.systemVolts.toFixed(2)}V` : 'N/A'}
            />
            <MetricRow
              label="Last update"
              value={sensor.hasTelemetry ? formatRelativeTime(sensor.lastUpdate) : 'N/A'}
            />
            <View className="flex-row items-center justify-between py-3">
              <Text style={{ color: colors.textMuted, fontSize: 14 }}>Shut-off valve</Text>
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>
                {sensor.controllable ? 'Installed' : 'None'}
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
