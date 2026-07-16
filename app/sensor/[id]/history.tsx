import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors } from '../../../src/constants/theme';
import { useSensor } from '../../../src/lib/sensorStore';
import { sensorTypeMeta } from '../../../src/lib/mockData';
import {
  buildSeriesFromMeasurements,
  rangeMeta,
  type HistorySeries,
  type TimeRange,
} from '../../../src/lib/history';
import { getModuleMeasurements, toDateParam, type ModuleRecord } from '../../../src/lib/api';
import { LineChart } from '../../../src/components/LineChart';
import { useSubscription } from '../../../src/lib/subscription';
import { PremiumBadge } from '../../../src/components/PremiumGate';

const RANGES: TimeRange[] = ['24h', '7d', '30d'];

type FetchState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'done'; records: ModuleRecord[]; series: HistorySeries | null };

function StatBox({ label, value, tint }: { label: string; value: string; tint?: string }) {
  return (
    <View
      className="flex-1 rounded-xl p-3"
      style={{ backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border }}
    >
      <Text style={{ color: colors.textFaint, fontSize: 11 }}>{label}</Text>
      <Text style={{ color: tint ?? colors.text, fontSize: 17, fontWeight: '800', marginTop: 3 }}>
        {value}
      </Text>
    </View>
  );
}

export default function SensorHistory() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { sensor } = useSensor(id);
  const { width } = useWindowDimensions();
  const { isPremium } = useSubscription();
  const [range, setRange] = useState<TimeRange>('24h');
  const [state, setState] = useState<FetchState>({ phase: 'loading' });

  // Fetch REAL measurements from the server for the selected range.
  // DATA POLICY: nothing simulated — if the server returns nothing, we
  // show an explicit "No data" state, never fabricated values.
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setState({ phase: 'loading' });
    const to = new Date();
    const from = new Date(to.getTime() - rangeMeta[range].days * 24 * 60 * 60 * 1000);
    getModuleMeasurements(id, toDateParam(from), toDateParam(to), 500)
      .then((records) => {
        if (cancelled) return;
        setState({
          phase: 'done',
          records,
          series: buildSeriesFromMeasurements(records, range),
        });
      })
      .catch((e) => {
        if (cancelled) return;
        setState({ phase: 'error', message: e instanceof Error ? e.message : 'Request failed' });
      });
    return () => {
      cancelled = true;
    };
  }, [id, range]);

  if (!sensor) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: colors.bg }}>
        <Text style={{ color: colors.textMuted }}>Sensor not found</Text>
      </SafeAreaView>
    );
  }

  const meta = sensorTypeMeta[sensor.type];
  const chartW = width - 40 - 30; // screen padding + y-axis label gutter
  const series = state.phase === 'done' ? state.series : null;
  const unit = series?.metricUnit ?? '';
  const up = (series?.changePct ?? 0) >= 0;

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
        {/* Range selector */}
        <View
          className="flex-row p-1 rounded-xl mb-5"
          style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
        >
          {RANGES.map((r) => {
            const active = r === range;
            const locked = !isPremium && r !== '24h';
            return (
              <Pressable
                key={r}
                onPress={() => (locked ? router.push('/settings/subscription') : setRange(r))}
                className="flex-1 py-2 rounded-lg items-center active:opacity-80 flex-row justify-center"
                style={{ backgroundColor: active ? colors.primary : 'transparent' }}
              >
                <Text
                  style={{
                    color: active ? colors.bg : locked ? colors.textFaint : colors.textMuted,
                    fontSize: 13,
                    fontWeight: '700',
                  }}
                >
                  {rangeMeta[r].label}
                </Text>
                {locked && (
                  <Ionicons
                    name="lock-closed"
                    size={11}
                    color={colors.textFaint}
                    style={{ marginLeft: 4 }}
                  />
                )}
              </Pressable>
            );
          })}
        </View>

        {!isPremium && (
          <Pressable
            onPress={() => router.push('/settings/subscription')}
            className="flex-row items-center rounded-xl p-3 mb-4 active:opacity-80"
            style={{ backgroundColor: 'rgba(45,212,191,0.10)', borderWidth: 1, borderColor: colors.primary + '40' }}
          >
            <Ionicons name="lock-closed" size={15} color={colors.primary} />
            <Text style={{ color: colors.textMuted, fontSize: 12, marginLeft: 8, flex: 1, lineHeight: 17 }}>
              Free plan shows the last 24 hours. Upgrade for 7-day and 30-day trends.
            </Text>
            <PremiumBadge />
          </Pressable>
        )}

        {/* Loading */}
        {state.phase === 'loading' && (
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

        {/* Error */}
        {state.phase === 'error' && (
          <View
            className="rounded-2xl p-5"
            style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.danger + '55' }}
          >
            <View className="flex-row items-center mb-2">
              <Ionicons name="cloud-offline" size={18} color={colors.danger} />
              <Text style={{ color: colors.danger, fontSize: 15, fontWeight: '700', marginLeft: 8 }}>
                Server unreachable
              </Text>
            </View>
            <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 19 }}>
              Could not fetch measurement history ({state.message}). No data is shown — this app
              never displays simulated values.
            </Text>
            <Pressable
              onPress={() => setRange((r) => r)}
              className="mt-3 py-2.5 rounded-xl items-center active:opacity-80"
              style={{ backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border }}
            >
              <Text
                style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}
                onPress={() => {
                  // re-trigger fetch by toggling state
                  setState({ phase: 'loading' });
                  const to = new Date();
                  const from = new Date(to.getTime() - rangeMeta[range].days * 24 * 60 * 60 * 1000);
                  getModuleMeasurements(id!, toDateParam(from), toDateParam(to), 500)
                    .then((records) =>
                      setState({ phase: 'done', records, series: buildSeriesFromMeasurements(records, range) }),
                    )
                    .catch((e) =>
                      setState({ phase: 'error', message: e instanceof Error ? e.message : 'Request failed' }),
                    );
                }}
              >
                Retry
              </Text>
            </Pressable>
          </View>
        )}

        {/* No records */}
        {state.phase === 'done' && !series && (
          <View
            className="rounded-2xl p-8 items-center"
            style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
          >
            <Ionicons name="analytics-outline" size={28} color={colors.textFaint} />
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 10 }}>
              No measurements in this range
            </Text>
            <Text
              style={{ color: colors.textMuted, fontSize: 13, marginTop: 6, textAlign: 'center', lineHeight: 19 }}
            >
              The server returned {state.phase === 'done' ? state.records.length : 0} record(s) for
              the selected {rangeMeta[range].label} window. Try a wider range.
            </Text>
          </View>
        )}

        {/* Real data */}
        {series && (
          <>
            <View className="flex-row items-end justify-between mb-4">
              <View>
                <Text style={{ color: colors.textFaint, fontSize: 12 }}>
                  Latest · {series.metricLabel}
                </Text>
                <Text style={{ color: colors.text, fontSize: 30, fontWeight: '800' }}>
                  {series.last}
                  {unit}
                </Text>
              </View>
              <View
                className="flex-row items-center px-3 py-1.5 rounded-full"
                style={{ backgroundColor: up ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)' }}
              >
                <Ionicons
                  name={up ? 'trending-up' : 'trending-down'}
                  size={14}
                  color={up ? colors.online : colors.danger}
                />
                <Text
                  style={{
                    color: up ? colors.online : colors.danger,
                    fontSize: 13,
                    fontWeight: '700',
                    marginLeft: 5,
                  }}
                >
                  {up ? '+' : ''}
                  {series.changePct}%
                </Text>
              </View>
            </View>

            <View
              className="rounded-2xl p-4"
              style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
            >
              <View className="flex-row items-center mb-2">
                <Ionicons name={meta.icon as any} size={15} color={colors.primary} />
                <Text style={{ color: colors.textMuted, fontSize: 13, marginLeft: 6, fontWeight: '600' }}>
                  {series.metricLabel} · {rangeMeta[range].label} · {series.points.length} records (live)
                </Text>
              </View>
              <LineChart series={series} width={chartW} unit={unit} />
            </View>

            <View className="flex-row gap-3 mt-4">
              <StatBox label="Min" value={`${series.min}${unit}`} />
              <StatBox label="Avg" value={`${series.avg}${unit}`} tint={colors.primary} />
              <StatBox label="Max" value={`${series.max}${unit}`} />
            </View>

            <View
              className="rounded-2xl p-4 mt-4"
              style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
            >
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700', marginBottom: 6 }}>
                Trend Insight
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 19 }}>
                Based on {series.points.length} real measurement record(s) from the server over the
                last {rangeMeta[range].label.toLowerCase()}: {series.metricLabel} {up ? 'rose' : 'fell'} by{' '}
                {Math.abs(series.changePct)}%, ranging from {series.min}
                {unit} to {series.max}
                {unit}, averaging {series.avg}
                {unit}.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
