import { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors } from '../../../src/constants/theme';
import { useSensor } from '../../../src/lib/sensorStore';
import {
  useMeasurementData,
  extractSeries,
  downsampleSeries,
  WINDOW_24H_MS,
  WINDOW_7D_MS,
  WINDOW_30D_MS,
  type MeasurementRecord,
  type TrendPoint,
} from '../../../src/lib/measurementData';
import {
  TrendChart,
  TREND_COLORS,
  type TimeBand,
  type XTick,
} from '../../../src/components/TrendChart';

// Engineering trends — multi-day charts built ONLY from real
// GetModuleMeasments records (shared 30d cache in measurementData).
//
// DATA POLICY: nothing is simulated. Empty window → an explicit "No records"
// state; a max_count-capped fetch surfaces an explicit truncation note.

type WindowKey = '24h' | '7d' | '30d';

const WINDOWS: { key: WindowKey; label: string; ms: number }[] = [
  { key: '24h', label: '24H', ms: WINDOW_24H_MS },
  { key: '7d', label: '7D', ms: WINDOW_7D_MS },
  { key: '30d', label: '30D', ms: WINDOW_30D_MS },
];

const MAX_POINTS = 200; // per-series downsample cap — keeps SVG paths fast

// ── Small pieces ─────────────────────────────────────────────────────────────

function seriesStats(pts: TrendPoint[]): { min: number; max: number; latest: number } | null {
  if (pts.length === 0) return null;
  let min = pts[0].value;
  let max = pts[0].value;
  for (const p of pts) {
    if (p.value < min) min = p.value;
    if (p.value > max) max = p.value;
  }
  return { min, max, latest: pts[pts.length - 1].value };
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <View
      className="flex-1 rounded-xl px-3 py-2"
      style={{ backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border }}
    >
      <Text style={{ color: colors.textFaint, fontSize: 10, fontWeight: '700', letterSpacing: 0.6 }}>
        {label}
      </Text>
      <Text
        numberOfLines={1}
        style={{ color: colors.text, fontSize: 13, fontWeight: '800', marginTop: 2 }}
      >
        {value}
      </Text>
    </View>
  );
}

function ChartCard({
  icon,
  title,
  subtitle,
  stats,
  fmt,
  children,
  empty,
}: {
  icon: string;
  title: string;
  subtitle?: string;
  stats: { min: number; max: number; latest: number } | null;
  fmt: (v: number) => string;
  children: React.ReactNode;
  empty: boolean;
}) {
  return (
    <View
      className="rounded-2xl"
      style={{
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 20,
        marginBottom: 16,
      }}
    >
      <View className="flex-row items-center mb-3">
        <Ionicons name={icon as any} size={15} color={colors.primary} />
        <View style={{ marginLeft: 7, flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>{title}</Text>
          {subtitle ? (
            <Text style={{ color: colors.textFaint, fontSize: 11, marginTop: 1 }}>{subtitle}</Text>
          ) : null}
        </View>
      </View>

      {empty ? (
        <View className="items-center" style={{ paddingVertical: 26 }}>
          <Ionicons name="analytics-outline" size={22} color={colors.textFaint} />
          <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 8 }}>
            No records in this window
          </Text>
        </View>
      ) : (
        <>
          {children}
          {stats && (
            <View className="flex-row" style={{ gap: 8, marginTop: 12 }}>
              <StatChip label="MIN" value={fmt(stats.min)} />
              <StatChip label="MAX" value={fmt(stats.max)} />
              <StatChip label="LATEST" value={fmt(stats.latest)} />
            </View>
          )}
        </>
      )}
    </View>
  );
}

// ── Time axis ────────────────────────────────────────────────────────────────

function makeXTicks(tStart: number, tEnd: number, win: WindowKey): XTick[] {
  const fracs = [0, 1 / 3, 2 / 3, 1];
  return fracs.map((f) => {
    const t = tStart + (tEnd - tStart) * f;
    const d = new Date(t);
    const label =
      win === '24h'
        ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : d.toLocaleDateString([], { month: 'numeric', day: 'numeric' });
    return { t, label };
  });
}

// Contiguous spans where the pressure switch is CLOSED (raw value 0 —
// vendor-confirmed polarity: 1 = open, 0 = closed).
function switchClosedBands(records: MeasurementRecord[]): TimeBand[] {
  const bands: TimeBand[] = [];
  let cur: TimeBand | null = null;
  for (const r of records) {
    if (r.pressureSwitchStart === null) continue;
    if (r.pressureSwitchStart === false) {
      if (cur) cur.end = r.t;
      else cur = { start: r.t, end: r.t };
    } else if (cur) {
      bands.push(cur);
      cur = null;
    }
  }
  if (cur) bands.push(cur);
  return bands;
}

// ── Formatters (labels wear text tokens; units live here) ───────────────────

const fmtHz = (v: number) => `${Math.round(v * 10) / 10} Hz`;
const fmtV = (v: number) => `${v.toFixed(2)} V`;
const fmtMa = (v: number) => `${Math.round(v * 10) / 10} mA`;
const fmtC = (v: number) => `${Math.round(v * 10) / 10}°C`;
const fmtOpen = (v: number) => (v >= 0.5 ? 'Open' : 'Closed');
const fmtLeak = (v: number) => (v >= 0.5 ? 'Leak' : 'Clear');

// ── Screen ───────────────────────────────────────────────────────────────────

export default function SensorHistory() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { sensor } = useSensor(id);
  const { width } = useWindowDimensions();
  const [win, setWin] = useState<WindowKey>('24h');

  const windowMs = WINDOWS.find((w) => w.key === win)!.ms;
  const { loading, records, truncated } = useMeasurementData(id, windowMs);

  const chartW = width - 40 - 40; // screen padding (20×2) + card padding (20×2)

  const trends = useMemo(() => {
    const tEnd = Date.now();
    const tStart = tEnd - windowMs;

    const pressure = extractSeries(records, (r) => r.pressureFreq);
    const batVolts = extractSeries(records, (r) => r.sysVolts);
    const chgVolts = extractSeries(records, (r) => r.chargeVolts);
    const batAmps = extractSeries(records, (r) => (r.sysAmps === null ? null : r.sysAmps * 1000));
    const chgAmps = extractSeries(records, (r) =>
      r.chargeAmps === null ? null : r.chargeAmps * 1000,
    );
    const flow = extractSeries(records, (r) => r.flowFreq);
    const temp = extractSeries(records, (r) => r.temperatureC);
    const valve = extractSeries(records, (r) => r.valveState);
    const leak = extractSeries(records, (r) => (r.leakDetected ? 1 : 0));

    return {
      tStart,
      tEnd,
      xTicks: makeXTicks(tStart, tEnd, win),
      closedBands: switchClosedBands(records),
      pressure: { pts: downsampleSeries(pressure, MAX_POINTS, 'mean'), stats: seriesStats(pressure) },
      batVolts: { pts: downsampleSeries(batVolts, MAX_POINTS, 'mean'), stats: seriesStats(batVolts) },
      chgVolts: { pts: downsampleSeries(chgVolts, MAX_POINTS, 'mean') },
      batAmps: { pts: downsampleSeries(batAmps, MAX_POINTS, 'mean'), stats: seriesStats(batAmps) },
      chgAmps: { pts: downsampleSeries(chgAmps, MAX_POINTS, 'mean') },
      flow: { pts: downsampleSeries(flow, MAX_POINTS, 'mean'), stats: seriesStats(flow) },
      temp: { pts: downsampleSeries(temp, MAX_POINTS, 'mean'), stats: seriesStats(temp) },
      valve: { pts: downsampleSeries(valve, MAX_POINTS, 'last'), stats: seriesStats(valve) },
      leak: { pts: downsampleSeries(leak, MAX_POINTS, 'max'), stats: seriesStats(leak) },
    };
  }, [records, windowMs, win]);

  if (!sensor) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: colors.bg }}>
        <Text style={{ color: colors.textMuted }}>Sensor not found</Text>
      </SafeAreaView>
    );
  }

  const hasData = records.length > 0;
  const common = { width: chartW, tStart: trends.tStart, tEnd: trends.tEnd, xTicks: trends.xTicks };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.bg }} edges={['top']}>
      <View className="flex-row items-center px-5 py-3">
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full items-center justify-center active:opacity-70"
          style={{ backgroundColor: colors.surface }}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <View style={{ marginLeft: 12 }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>History & Trends</Text>
          <Text style={{ color: colors.textFaint, fontSize: 12 }}>{sensor.defaultName}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Window selector — all windows unlocked */}
        <View
          className="flex-row p-1 rounded-xl mb-4"
          style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
        >
          {WINDOWS.map((w) => {
            const active = w.key === win;
            return (
              <Pressable
                key={w.key}
                onPress={() => setWin(w.key)}
                className="flex-1 py-2 rounded-lg items-center active:opacity-80"
                style={{ backgroundColor: active ? colors.primary : 'transparent' }}
              >
                <Text
                  style={{
                    color: active ? colors.bg : colors.textMuted,
                    fontSize: 13,
                    fontWeight: '700',
                  }}
                >
                  {w.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Loading */}
        {loading && (
          <View
            className="rounded-2xl p-8 items-center"
            style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
          >
            <ActivityIndicator color={colors.primary} />
            <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 10 }}>
              Fetching measurements from server…
            </Text>
          </View>
        )}

        {/* Empty window — honest, per the app's pattern */}
        {!loading && !hasData && (
          <View
            className="rounded-2xl p-8 items-center"
            style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
          >
            <Ionicons name="analytics-outline" size={28} color={colors.textFaint} />
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 10 }}>
              No records in this window
            </Text>
            <Text
              style={{ color: colors.textMuted, fontSize: 13, marginTop: 6, textAlign: 'center', lineHeight: 19 }}
            >
              The server returned no measurements for the selected window (or was unreachable).
              Nothing is simulated — charts appear the moment real records exist.
            </Text>
          </View>
        )}

        {!loading && hasData && (
          <>
            <Text style={{ color: colors.textFaint, fontSize: 11, marginBottom: 12 }}>
              {records.length} records · live server data
            </Text>

            {/* Truncation honesty — the fetch hit max_count inside this window */}
            {truncated && (
              <View
                className="flex-row items-start rounded-xl p-3 mb-4"
                style={{
                  backgroundColor: 'rgba(254,190,100,0.10)',
                  borderWidth: 1,
                  borderColor: 'rgba(254,190,100,0.35)',
                }}
              >
                <Ionicons name="information-circle-outline" size={15} color={colors.warning} style={{ marginTop: 1 }} />
                <Text style={{ color: colors.textMuted, fontSize: 12, marginLeft: 8, flex: 1, lineHeight: 17 }}>
                  The server capped this fetch — showing the {records.length} most recent records
                  in this window. Older records in the window are not charted.
                </Text>
              </View>
            )}

            {/* 1 — Pressure vs Switch */}
            <ChartCard
              icon="speedometer-outline"
              title="Pressure vs Switch"
              subtitle="Shaded spans = pressure switch closed"
              stats={trends.pressure.stats}
              fmt={fmtHz}
              empty={trends.pressure.pts.length === 0 && trends.closedBands.length === 0}
            >
              <TrendChart
                {...common}
                series={[{ label: 'Pressure (Hz)', color: TREND_COLORS.blue, points: trends.pressure.pts }]}
                bands={trends.closedBands}
                bandLabel="Switch closed"
                yFormat={(v) => `${Math.round(v * 10) / 10}`}
              />
            </ChartCard>

            {/* 2 — Battery & Charge Voltage */}
            <ChartCard
              icon="battery-charging-outline"
              title="Battery & Charge Voltage"
              subtitle="Volts, shared axis"
              stats={trends.batVolts.stats}
              fmt={fmtV}
              empty={trends.batVolts.pts.length === 0 && trends.chgVolts.pts.length === 0}
            >
              <TrendChart
                {...common}
                series={[
                  { label: 'Battery (V)', color: TREND_COLORS.blue, points: trends.batVolts.pts },
                  { label: 'Charge (V)', color: TREND_COLORS.orange, points: trends.chgVolts.pts },
                ]}
                yFormat={(v) => v.toFixed(2)}
              />
            </ChartCard>

            {/* 3 — Current Draw (mA) */}
            <ChartCard
              icon="flash-outline"
              title="Current Draw"
              subtitle="Milliamps, shared axis"
              stats={trends.batAmps.stats}
              fmt={fmtMa}
              empty={trends.batAmps.pts.length === 0 && trends.chgAmps.pts.length === 0}
            >
              <TrendChart
                {...common}
                series={[
                  { label: 'Battery (mA)', color: TREND_COLORS.blue, points: trends.batAmps.pts },
                  { label: 'Charge (mA)', color: TREND_COLORS.orange, points: trends.chgAmps.pts },
                ]}
                yFormat={(v) => `${Math.round(v * 10) / 10}`}
              />
            </ChartCard>

            {/* 4 — Flow */}
            <ChartCard
              icon="water-outline"
              title="Flow"
              subtitle="Flow sensor frequency (Hz)"
              stats={trends.flow.stats}
              fmt={fmtHz}
              empty={trends.flow.pts.length === 0}
            >
              <TrendChart
                {...common}
                series={[{ label: 'Flow (Hz)', color: TREND_COLORS.aqua, points: trends.flow.pts }]}
                yFormat={(v) => `${Math.round(v * 10) / 10}`}
              />
            </ChartCard>

            {/* 5 — Temperature */}
            <ChartCard
              icon="thermometer-outline"
              title="Temperature"
              subtitle="°C"
              stats={trends.temp.stats}
              fmt={fmtC}
              empty={trends.temp.pts.length === 0}
            >
              <TrendChart
                {...common}
                series={[{ label: 'Temperature (°C)', color: TREND_COLORS.yellow, points: trends.temp.pts }]}
                yFormat={(v) => `${Math.round(v * 10) / 10}`}
              />
            </ChartCard>

            {/* 6 — Valve State (1 = open, 0 = closed — vendor-confirmed) */}
            <ChartCard
              icon="power"
              title="Valve State"
              subtitle="Step line · 1 = open, 0 = closed"
              stats={trends.valve.stats}
              fmt={fmtOpen}
              empty={trends.valve.pts.length === 0}
            >
              <TrendChart
                {...common}
                series={[{ label: 'Valve', color: TREND_COLORS.blue, points: trends.valve.pts }]}
                step
                height={120}
                yDomain={[0, 1]}
                yTicks={[0, 1]}
                yFormat={fmtOpen}
              />
            </ChartCard>

            {/* 7 — Leak detection (folded in from the old history screen) */}
            <ChartCard
              icon="warning-outline"
              title="Leak Detection"
              subtitle="Step line · any leak flag in a bucket is kept"
              stats={trends.leak.stats}
              fmt={fmtLeak}
              empty={trends.leak.pts.length === 0}
            >
              <TrendChart
                {...common}
                series={[{ label: 'Leak', color: TREND_COLORS.red, points: trends.leak.pts }]}
                step
                height={120}
                yDomain={[0, 1]}
                yTicks={[0, 1]}
                yFormat={fmtLeak}
              />
            </ChartCard>

            <Text style={{ color: colors.textFaint, fontSize: 11, textAlign: 'center', lineHeight: 16 }}>
              Series over {records.length} real records are bucketed to ≤{MAX_POINTS} points per
              chart (mean for analog signals, last for step signals, max for leak flags). No value
              is ever fabricated.
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
