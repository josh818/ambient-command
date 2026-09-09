import { useEffect, useMemo, useState } from 'react';
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
  deriveSwitchFlushes,
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

// Label format follows the VISIBLE span, not the outer window — so zooming
// into a few hours of a 30-day window still shows clock times.
function makeXTicks(tStart: number, tEnd: number): XTick[] {
  const span = tEnd - tStart;
  const useTime = span <= WINDOW_24H_MS * 1.5;
  const fracs = [0, 1 / 3, 2 / 3, 1];
  return fracs.map((f) => {
    const t = tStart + span * f;
    const d = new Date(t);
    const label = useTime
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
const fmtFlush = (v: number) => (v >= 0.5 ? 'Flush' : 'Idle');

function fmtRange(start: number, end: number): string {
  const s = new Date(start);
  const e = new Date(end);
  const sameDay = s.toDateString() === e.toDateString();
  const t = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const d = (dd: Date) => dd.toLocaleDateString([], { month: 'numeric', day: 'numeric' });
  return sameDay ? `${d(s)} ${t(s)}–${t(e)}` : `${d(s)} ${t(s)} – ${d(e)} ${t(e)}`;
}

function fmtSpan(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min}m`;
  const hr = ms / 3600000;
  if (hr < 48) return `${Math.round(hr * 10) / 10}h`;
  return `${Math.round(hr / 24)}d`;
}

function ZoomBtn({
  icon,
  label,
  onPress,
  disabled,
  primary,
}: {
  icon: string;
  label?: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label ?? icon}
      className="flex-row items-center justify-center active:opacity-70"
      style={{
        height: 34,
        paddingHorizontal: label ? 12 : 10,
        borderRadius: 10,
        backgroundColor: primary ? colors.primary : colors.surfaceAlt,
        borderWidth: 1,
        borderColor: primary ? colors.primary : colors.border,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Ionicons name={icon as any} size={16} color={primary ? colors.bg : colors.text} />
      {label ? (
        <Text
          style={{
            color: primary ? colors.bg : colors.text,
            fontSize: 12,
            fontWeight: '700',
            marginLeft: 4,
          }}
        >
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────

const MIN_VIEW_MS = 5 * 60 * 1000; // don't zoom tighter than 5 minutes

export default function SensorHistory() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { sensor } = useSensor(id);
  const { width } = useWindowDimensions();
  const [win, setWin] = useState<WindowKey>('24h');

  const windowMs = WINDOWS.find((w) => w.key === win)!.ms;
  const { loading, records, truncated } = useMeasurementData(id, windowMs);

  const chartW = width - 40 - 40; // screen padding (20×2) + card padding (20×2)

  // Full domain for the selected window. Frozen per data load so zoom/pan
  // interactions don't make the domain drift under the user.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fullEnd = useMemo(() => Date.now(), [records, windowMs]);
  const fullStart = fullEnd - windowMs;

  // Zoom/pan view sub-range. null = the whole window. Reset when the window
  // button changes.
  const [view, setView] = useState<{ start: number; end: number } | null>(null);
  useEffect(() => setView(null), [win]);

  const vStart = view ? view.start : fullStart;
  const vEnd = view ? view.end : fullEnd;
  const zoomed = view !== null;

  // Records inside the visible sub-range — re-sliced so zooming in reveals
  // more detail (each downsample bucket covers a narrower slice of time).
  const visibleRecords = useMemo(
    () => records.filter((r) => r.t >= vStart && r.t <= vEnd),
    [records, vStart, vEnd],
  );

  // ── Zoom/pan controls ──────────────────────────────────────────────────────
  const applyView = (start: number, end: number) => {
    const s = Math.max(fullStart, start);
    const e = Math.min(fullEnd, end);
    if (e - s < MIN_VIEW_MS) return;
    setView(s <= fullStart && e >= fullEnd ? null : { start: s, end: e });
  };
  const zoomIn = () => {
    const span = vEnd - vStart;
    const next = span * 0.55;
    if (next < MIN_VIEW_MS) return;
    const mid = vStart + span / 2;
    applyView(mid - next / 2, mid + next / 2);
  };
  const zoomOut = () => {
    const span = vEnd - vStart;
    const next = span / 0.55;
    const mid = vStart + span / 2;
    applyView(mid - next / 2, mid + next / 2);
  };
  const panBy = (frac: number) => {
    const span = vEnd - vStart;
    const shift = span * frac;
    let s = vStart + shift;
    let e = vEnd + shift;
    if (s < fullStart) { s = fullStart; e = s + span; }
    if (e > fullEnd) { e = fullEnd; s = e - span; }
    applyView(s, e);
  };

  const flush = useMemo(() => deriveSwitchFlushes(visibleRecords), [visibleRecords]);

  const trends = useMemo(() => {
    const tStart = vStart;
    const tEnd = vEnd;

    const pressure = extractSeries(visibleRecords, (r) => r.pressureFreq);
    const batVolts = extractSeries(visibleRecords, (r) => r.sysVolts);
    const chgVolts = extractSeries(visibleRecords, (r) => r.chargeVolts);
    const batAmps = extractSeries(visibleRecords, (r) => (r.sysAmps === null ? null : r.sysAmps * 1000));
    const chgAmps = extractSeries(visibleRecords, (r) =>
      r.chargeAmps === null ? null : r.chargeAmps * 1000,
    );
    const flowS = extractSeries(visibleRecords, (r) => r.flowFreq);
    const temp = extractSeries(visibleRecords, (r) => r.temperatureC);
    const valve = extractSeries(visibleRecords, (r) => r.valveState);
    const leak = extractSeries(visibleRecords, (r) => (r.leakDetected ? 1 : 0));

    return {
      tStart,
      tEnd,
      xTicks: makeXTicks(tStart, tEnd),
      closedBands: switchClosedBands(visibleRecords),
      pressure: { pts: downsampleSeries(pressure, MAX_POINTS, 'mean'), stats: seriesStats(pressure) },
      batVolts: { pts: downsampleSeries(batVolts, MAX_POINTS, 'mean'), stats: seriesStats(batVolts) },
      chgVolts: { pts: downsampleSeries(chgVolts, MAX_POINTS, 'mean') },
      batAmps: { pts: downsampleSeries(batAmps, MAX_POINTS, 'mean'), stats: seriesStats(batAmps) },
      chgAmps: { pts: downsampleSeries(chgAmps, MAX_POINTS, 'mean') },
      flow: { pts: downsampleSeries(flowS, MAX_POINTS, 'mean'), stats: seriesStats(flowS) },
      temp: { pts: downsampleSeries(temp, MAX_POINTS, 'mean'), stats: seriesStats(temp) },
      valve: { pts: downsampleSeries(valve, MAX_POINTS, 'last'), stats: seriesStats(valve) },
      leak: { pts: downsampleSeries(leak, MAX_POINTS, 'max'), stats: seriesStats(leak) },
      flushPulse: downsampleSeries(flush.pulse, MAX_POINTS, 'last'),
    };
  }, [visibleRecords, vStart, vEnd, flush.pulse]);

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

        {/* Zoom / pan toolbar — one shared time domain drives every chart, so
            pressure and switch (and everything else) stay aligned as you drill in. */}
        {!loading && hasData && (
          <View
            className="rounded-xl mb-4 px-3 py-2.5"
            style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
          >
            <View className="flex-row items-center">
              <Ionicons name="search-outline" size={14} color={colors.textFaint} />
              <Text style={{ color: colors.textMuted, fontSize: 12, marginLeft: 6, flex: 1 }} numberOfLines={1}>
                {zoomed
                  ? `${fmtRange(vStart, vEnd)} · ${fmtSpan(vEnd - vStart)}`
                  : `Full ${WINDOWS.find((w) => w.key === win)!.label} · zoom to inspect`}
              </Text>
            </View>
            <View className="flex-row items-center" style={{ gap: 8, marginTop: 8 }}>
              <ZoomBtn icon="chevron-back" onPress={() => panBy(-0.3)} disabled={!zoomed} />
              <ZoomBtn icon="remove" label="Out" onPress={zoomOut} disabled={!zoomed} />
              <ZoomBtn
                icon="add"
                label="In"
                onPress={zoomIn}
                disabled={vEnd - vStart <= MIN_VIEW_MS}
                primary
              />
              <ZoomBtn icon="chevron-forward" onPress={() => panBy(0.3)} disabled={!zoomed} />
              <View style={{ flex: 1 }} />
              <ZoomBtn icon="scan-outline" label="Reset" onPress={() => setView(null)} disabled={!zoomed} />
            </View>
          </View>
        )}

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
              {zoomed
                ? `${visibleRecords.length} of ${records.length} records in view`
                : `${records.length} records · live server data`}
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

            {/* 1b — Flushes (pressure switch actuation) */}
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
                <Ionicons name="pulse-outline" size={15} color={colors.primary} />
                <View style={{ marginLeft: 7, flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>Flushes</Text>
                  <Text style={{ color: colors.textFaint, fontSize: 11, marginTop: 1 }}>
                    Each pressure-switch actuation (open → closed) = one flush
                  </Text>
                </View>
              </View>

              {trends.flushPulse.length === 0 ? (
                <View className="items-center" style={{ paddingVertical: 26 }}>
                  <Ionicons name="pulse-outline" size={22} color={colors.textFaint} />
                  <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 8 }}>
                    No pressure-switch readings in this window
                  </Text>
                </View>
              ) : (
                <>
                  {/* Big flush count for the visible window */}
                  <View className="flex-row items-end" style={{ marginBottom: 12 }}>
                    <Text style={{ color: colors.primary, fontSize: 34, fontWeight: '800', lineHeight: 36 }}>
                      {flush.count}
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: 13, marginLeft: 8, marginBottom: 4 }}>
                      {flush.count === 1 ? 'flush' : 'flushes'}
                      {zoomed ? ' in view' : ` in ${WINDOWS.find((w) => w.key === win)!.label}`}
                    </Text>
                    {flush.lastAt ? (
                      <Text style={{ color: colors.textFaint, fontSize: 12, marginLeft: 'auto', marginBottom: 4 }}>
                        last {new Date(flush.lastAt).toLocaleString([], {
                          month: 'numeric',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    ) : null}
                  </View>

                  <TrendChart
                    {...common}
                    series={[{ label: 'Flush', color: TREND_COLORS.aqua, points: trends.flushPulse }]}
                    step
                    height={120}
                    yDomain={[0, 1]}
                    yTicks={[0, 1]}
                    yFormat={fmtFlush}
                  />
                </>
              )}
            </View>

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
