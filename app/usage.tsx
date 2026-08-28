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
import { useRouter } from 'expo-router';
import { colors } from '../src/constants/theme';
import { useSensors } from '../src/lib/sensorStore';
import { rangeMeta, type TimeRange } from '../src/lib/history';
import { useUsageAnalytics, useMonthToDateUsage } from '../src/lib/usageHistory';
import { UsageBarChart } from '../src/components/UsageBarChart';
import { useNotificationPrefs } from '../src/lib/notificationPrefs';
import { NoDevicesAssigned } from '../src/components/NoDevicesAssigned';

// Water Usage Analytics — Flo-style usage tracking + conservation goals.
//
// DATA POLICY: every number on this screen comes from real GetModuleMeasments
// records (same endpoint sparkHistory uses, longer windows). When the server
// has no history the screen shows an explicit "Awaiting telemetry" state.
//
// DEVICE SCOPING: sensors come from useSensors(), which is already filtered
// per-account via useDeviceAccess — only assigned modules are queried.

const RANGES: TimeRange[] = ['24h', '7d', '30d'];
const GOAL_STEP = 25;

function fmt(n: number): string {
  if (Math.abs(n) >= 1000) return `${Math.round(n / 100) / 10}k`;
  return `${Math.round(n * 100) / 100}`;
}

function StatTile({ label, value, sub, tint }: { label: string; value: string; sub?: string; tint?: string }) {
  return (
    <View
      className="flex-1 rounded-2xl"
      style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 14 }}
    >
      <Text style={{ color: colors.textFaint, fontSize: 11, fontWeight: '700', letterSpacing: 0.6 }}>
        {label}
      </Text>
      <Text
        numberOfLines={1}
        style={{ color: tint ?? colors.text, fontSize: 20, fontWeight: '800', marginTop: 4 }}
      >
        {value}
      </Text>
      {sub ? (
        <Text numberOfLines={1} style={{ color: colors.textFaint, fontSize: 11, marginTop: 2 }}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

function AwaitingTelemetry({ detail }: { detail: string }) {
  return (
    <View
      className="rounded-2xl items-center"
      style={{
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        paddingVertical: 44,
        paddingHorizontal: 24,
      }}
    >
      <View
        className="items-center justify-center"
        style={{
          width: 76,
          height: 76,
          borderRadius: 38,
          backgroundColor: 'rgba(126,226,190,0.10)',
          borderWidth: 1,
          borderColor: 'rgba(126,226,190,0.30)',
        }}
      >
        <Ionicons name="water-outline" size={36} color={colors.primary} />
      </View>
      <Text style={{ color: colors.text, fontSize: 17, fontWeight: '800', marginTop: 16 }}>
        Awaiting telemetry
      </Text>
      <Text
        style={{ color: colors.textMuted, fontSize: 13, marginTop: 8, textAlign: 'center', lineHeight: 19 }}
      >
        {detail} Nothing is simulated — usage appears the moment real measurements arrive.
      </Text>
    </View>
  );
}

export default function UsageScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { sensors, ready, noDevicesAssigned, access } = useSensors();
  const { usageGoal, save } = useNotificationPrefs();

  const [range, setRange] = useState<TimeRange>('24h');
  const [scope, setScope] = useState<string | null>(null); // null = fleet
  const [selectedBar, setSelectedBar] = useState<number | null>(null);
  const [savingGoal, setSavingGoal] = useState(false);

  // Scope must always stay inside the user's assigned fleet.
  const scopeId = scope && sensors.some((s) => s.id === scope) ? scope : null;

  const { summary, loading } = useUsageAnalytics(sensors, range, scopeId);
  const month = useMonthToDateUsage(sensors);

  const chartW = width - 40 - 40; // screen padding (20×2) + card padding (20×2)
  const unitLabel = summary.metricUnit.trim() || 'units';
  const bucketNoun = range === '24h' ? 'hour' : 'day';

  // Trend: for water usage, up = worse (amber), down = better (green).
  const change = summary.changePct;
  const up = change !== null && change >= 0;

  // Conservation goal pacing (calendar month).
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthFraction = (now.getDate() - 1 + now.getHours() / 24) / daysInMonth;
  const goalFraction = usageGoal ? month.total / usageGoal : 0;
  const overPace = usageGoal ? goalFraction > monthFraction : false;
  const goalColor = !usageGoal
    ? colors.primary
    : goalFraction >= 1
      ? colors.danger
      : overPace
        ? colors.warning
        : colors.primary;

  const adjustGoal = async (delta: number) => {
    const next = Math.max(GOAL_STEP, (usageGoal ?? 0) + delta);
    setSavingGoal(true);
    try {
      await save({ usageGoal: next });
    } finally {
      setSavingGoal(false);
    }
  };

  const selected = selectedBar !== null ? summary.buckets[selectedBar] : null;

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
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>Water Usage</Text>
          <Text style={{ color: colors.textFaint, fontSize: 12 }}>
            Real telemetry · {scopeId ? sensors.find((s) => s.id === scopeId)?.defaultName : 'Full fleet'}
          </Text>
        </View>
      </View>

      {noDevicesAssigned ? (
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <NoDevicesAssigned email={access.userEmail} />
        </ScrollView>
      ) : !ready ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Range selector */}
          <View
            className="flex-row p-1 rounded-xl"
            style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
          >
            {RANGES.map((r) => {
              const active = r === range;
              return (
                <Pressable
                  key={r}
                  onPress={() => {
                    setRange(r);
                    setSelectedBar(null);
                  }}
                  className="flex-1 py-2 rounded-lg items-center active:opacity-80 flex-row justify-center"
                  style={{ backgroundColor: active ? colors.primary : 'transparent' }}
                >
                  <Text
                    style={{
                      color: active ? colors.bg : colors.textMuted,
                      fontSize: 13,
                      fontWeight: '700',
                    }}
                  >
                    {rangeMeta[r].label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Scope chips: fleet + each assigned sensor */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: 16 }}
            contentContainerStyle={{ gap: 8 }}
          >
            {[{ id: null as string | null, label: 'Fleet' }].concat(
              sensors.map((s) => ({ id: s.id as string | null, label: s.defaultName })),
            ).map((chip) => {
              const active = scopeId === chip.id;
              return (
                <Pressable
                  key={chip.id ?? '__fleet'}
                  onPress={() => {
                    setScope(chip.id);
                    setSelectedBar(null);
                  }}
                  className="px-4 py-2 rounded-full active:opacity-80"
                  style={{
                    backgroundColor: active ? 'rgba(126,226,190,0.15)' : colors.surface,
                    borderWidth: 1,
                    borderColor: active ? colors.primary : colors.border,
                  }}
                >
                  <Text
                    style={{
                      color: active ? colors.primary : colors.textMuted,
                      fontSize: 13,
                      fontWeight: '700',
                    }}
                  >
                    {chip.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Chart card */}
          <View style={{ marginTop: 16 }}>
            {loading ? (
              <View
                className="rounded-2xl items-center"
                style={{
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingVertical: 48,
                }}
              >
                <ActivityIndicator color={colors.primary} />
                <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 10 }}>
                  Fetching measurement history…
                </Text>
              </View>
            ) : !summary.hasData ? (
              <AwaitingTelemetry
                detail={`The server returned no measurement records for ${
                  scopeId ? 'this sensor' : 'your sensors'
                } in the last ${rangeMeta[range].label.toLowerCase()}.`}
              />
            ) : (
              <>
                <View
                  className="rounded-2xl"
                  style={{
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    padding: 20,
                  }}
                >
                  <View className="flex-row items-center justify-between">
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text style={{ color: colors.textFaint, fontSize: 12 }}>
                        {summary.metricLabel} · per {bucketNoun}
                      </Text>
                      <Text style={{ color: colors.text, fontSize: 30, fontWeight: '800', marginTop: 2 }}>
                        {fmt(summary.total)}
                        <Text style={{ color: colors.textMuted, fontSize: 15, fontWeight: '600' }}>
                          {' '}
                          {unitLabel}
                        </Text>
                      </Text>
                    </View>
                    {change !== null && (
                      <View
                        className="flex-row items-center px-3 py-1.5 rounded-full"
                        style={{
                          backgroundColor: up ? 'rgba(254,190,100,0.12)' : 'rgba(126,226,190,0.12)',
                        }}
                      >
                        <Ionicons
                          name={up ? 'trending-up' : 'trending-down'}
                          size={14}
                          color={up ? colors.warning : colors.online}
                        />
                        <Text
                          style={{
                            color: up ? colors.warning : colors.online,
                            fontSize: 13,
                            fontWeight: '700',
                            marginLeft: 5,
                          }}
                        >
                          {up ? '+' : ''}
                          {change}%
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={{ marginTop: 14 }}>
                    <UsageBarChart
                      buckets={summary.buckets}
                      width={chartW}
                      selectedIndex={selectedBar}
                      onSelect={setSelectedBar}
                    />
                  </View>

                  <View
                    className="flex-row items-center mt-3 pt-3"
                    style={{ borderTopWidth: 1, borderTopColor: colors.border }}
                  >
                    <Ionicons
                      name={selected ? 'analytics' : 'hand-left-outline'}
                      size={13}
                      color={selected ? colors.primary : colors.textFaint}
                    />
                    <Text style={{ color: selected ? colors.text : colors.textFaint, fontSize: 12, marginLeft: 6 }}>
                      {selected
                        ? `${selected.label} — ${fmt(selected.value)} ${unitLabel}`
                        : 'Tap a column to inspect it'}
                    </Text>
                    {change !== null && (
                      <Text style={{ color: colors.textFaint, fontSize: 11, marginLeft: 'auto' }}>
                        vs prior {rangeMeta[range].label.toLowerCase()}: {fmt(summary.prevTotal)} {unitLabel}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Stat tiles */}
                <View className="flex-row" style={{ gap: 12, marginTop: 16 }}>
                  <StatTile label="TOTAL" value={fmt(summary.total)} sub={unitLabel} tint={colors.primary} />
                  <StatTile label="AVG" value={fmt(summary.avgPerBucket)} sub={`per ${bucketNoun}`} />
                  <StatTile
                    label="PEAK"
                    value={summary.peak ? fmt(summary.peak.value) : '—'}
                    sub={summary.peak ? summary.peak.label : undefined}
                  />
                  <StatTile
                    label="MIN"
                    value={summary.minNonEmpty ? fmt(summary.minNonEmpty.value) : '—'}
                    sub={summary.minNonEmpty ? summary.minNonEmpty.label : undefined}
                  />
                </View>

                {/* Busiest sensor (fleet scope only) */}
                {!scopeId && summary.busiest && (
                  <Pressable
                    onPress={() => setScope(summary.busiest!.sensorId)}
                    className="rounded-2xl active:opacity-80"
                    style={{
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: colors.border,
                      padding: 20,
                      marginTop: 16,
                    }}
                  >
                    <View className="flex-row items-center">
                      <View
                        className="w-10 h-10 rounded-xl items-center justify-center"
                        style={{ backgroundColor: 'rgba(129,140,248,0.12)' }}
                      >
                        <Ionicons name="flame" size={20} color={colors.accent} />
                      </View>
                      <View className="flex-1" style={{ marginLeft: 12 }}>
                        <Text style={{ color: colors.textFaint, fontSize: 11, fontWeight: '700', letterSpacing: 0.6 }}>
                          BUSIEST SENSOR
                        </Text>
                        <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 2 }}>
                          {summary.busiest.name}
                        </Text>
                        <Text style={{ color: colors.textFaint, fontSize: 12, marginTop: 1 }}>
                          {summary.busiest.location}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>
                          {fmt(summary.busiest.total)}
                        </Text>
                        <Text style={{ color: colors.textFaint, fontSize: 11 }}>
                          {summary.total > 0
                            ? `${Math.round((summary.busiest.total / summary.total) * 100)}% of fleet`
                            : unitLabel}
                        </Text>
                      </View>
                    </View>
                    <View
                      className="h-1.5 rounded-full overflow-hidden"
                      style={{ backgroundColor: colors.surfaceAlt, marginTop: 12 }}
                    >
                      <View
                        className="h-full rounded-full"
                        style={{
                          width: `${
                            summary.total > 0
                              ? Math.min(100, Math.round((summary.busiest.total / summary.total) * 100))
                              : 0
                          }%`,
                          backgroundColor: colors.accent,
                        }}
                      />
                    </View>
                  </Pressable>
                )}
              </>
            )}
          </View>

          {/* Conservation goal */}
          <View
            className="rounded-2xl"
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 20,
              marginTop: 16,
            }}
          >
            <View className="flex-row items-center">
              <View
                className="w-10 h-10 rounded-xl items-center justify-center"
                style={{ backgroundColor: 'rgba(126,226,190,0.12)' }}
              >
                <Ionicons name="leaf" size={20} color={colors.primary} />
              </View>
              <View className="flex-1" style={{ marginLeft: 12 }}>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
                  Conservation Goal
                </Text>
                <Text style={{ color: colors.textFaint, fontSize: 12, marginTop: 1 }}>
                  {now.toLocaleDateString([], { month: 'long' })} target · fleet total in {unitLabel}
                </Text>
              </View>
              {usageGoal !== null && month.hasData && (
                <View
                  className="px-3 py-1.5 rounded-full"
                  style={{
                    backgroundColor:
                      goalFraction >= 1
                        ? 'rgba(224,114,89,0.12)'
                        : overPace
                          ? 'rgba(254,190,100,0.12)'
                          : 'rgba(126,226,190,0.12)',
                  }}
                >
                  <Text
                    style={{
                      color: goalFraction >= 1 ? colors.danger : overPace ? colors.warning : colors.online,
                      fontSize: 12,
                      fontWeight: '700',
                    }}
                  >
                    {goalFraction >= 1 ? 'Over goal' : overPace ? 'Over pace' : 'On pace'}
                  </Text>
                </View>
              )}
            </View>

            {month.loading ? (
              <View className="items-center" style={{ paddingVertical: 20 }}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : !month.hasData ? (
              <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 14, lineHeight: 19 }}>
                Awaiting telemetry — no measurements recorded this month yet, so goal progress cannot
                be computed from real data.
              </Text>
            ) : (
              <>
                <View className="flex-row items-end justify-between" style={{ marginTop: 16 }}>
                  <Text style={{ color: colors.text, fontSize: 24, fontWeight: '800' }}>
                    {fmt(month.total)}
                    <Text style={{ color: colors.textMuted, fontSize: 14, fontWeight: '600' }}>
                      {usageGoal !== null ? ` / ${fmt(usageGoal)} ${unitLabel}` : ` ${unitLabel} this month`}
                    </Text>
                  </Text>
                  {usageGoal !== null && (
                    <Text style={{ color: colors.textFaint, fontSize: 12 }}>
                      {Math.round(goalFraction * 100)}% used · {Math.round(monthFraction * 100)}% of month
                    </Text>
                  )}
                </View>

                {usageGoal !== null && (
                  <View style={{ marginTop: 12 }}>
                    {/* Meter: fill carries severity; track is a quiet surface step */}
                    <View
                      className="h-2.5 rounded-full overflow-hidden"
                      style={{ backgroundColor: colors.surfaceAlt }}
                    >
                      <View
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, Math.round(goalFraction * 100))}%`,
                          backgroundColor: goalColor,
                        }}
                      />
                    </View>
                    {/* Pace marker */}
                    <View
                      style={{
                        position: 'absolute',
                        left: `${Math.min(100, Math.round(monthFraction * 100))}%`,
                        top: -2,
                        width: 2,
                        height: 14,
                        backgroundColor: colors.textMuted,
                        borderRadius: 1,
                      }}
                    />
                    <Text style={{ color: colors.textFaint, fontSize: 11, marginTop: 8, lineHeight: 16 }}>
                      {goalFraction >= 1
                        ? 'Monthly target exceeded — consider closing valves on idle lines.'
                        : overPace
                          ? 'Usage is running ahead of the month — trim consumption to stay under target.'
                          : 'Usage is tracking under the month-to-date pace marker. Keep it up.'}
                    </Text>
                  </View>
                )}
              </>
            )}

            {/* Goal controls */}
            {usageGoal === null ? (
              <Pressable
                onPress={() => void adjustGoal(100)}
                disabled={savingGoal}
                className="rounded-xl items-center flex-row justify-center active:opacity-80"
                style={{
                  backgroundColor: 'rgba(126,226,190,0.12)',
                  borderWidth: 1,
                  borderColor: colors.primary + '55',
                  paddingVertical: 12,
                  marginTop: 16,
                  opacity: savingGoal ? 0.6 : 1,
                }}
              >
                <Ionicons name="flag-outline" size={16} color={colors.primary} />
                <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '700', marginLeft: 8 }}>
                  Set a monthly target
                </Text>
              </Pressable>
            ) : (
              <View className="flex-row items-center justify-center" style={{ marginTop: 16, gap: 14 }}>
                <Pressable
                  onPress={() => void adjustGoal(-GOAL_STEP)}
                  disabled={savingGoal}
                  className="w-11 h-11 rounded-xl items-center justify-center active:opacity-70"
                  style={{
                    backgroundColor: colors.surfaceAlt,
                    borderWidth: 1,
                    borderColor: colors.border,
                    opacity: savingGoal ? 0.5 : 1,
                  }}
                  accessibilityLabel="Decrease monthly goal"
                >
                  <Ionicons name="remove" size={20} color={colors.text} />
                </Pressable>
                <View style={{ minWidth: 96, alignItems: 'center' }}>
                  <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>
                    {fmt(usageGoal)}
                  </Text>
                  <Text style={{ color: colors.textFaint, fontSize: 11 }}>{unitLabel} / month</Text>
                </View>
                <Pressable
                  onPress={() => void adjustGoal(GOAL_STEP)}
                  disabled={savingGoal}
                  className="w-11 h-11 rounded-xl items-center justify-center active:opacity-70"
                  style={{
                    backgroundColor: colors.surfaceAlt,
                    borderWidth: 1,
                    borderColor: colors.border,
                    opacity: savingGoal ? 0.5 : 1,
                  }}
                  accessibilityLabel="Increase monthly goal"
                >
                  <Ionicons name="add" size={20} color={colors.text} />
                </Pressable>
              </View>
            )}
          </View>

          <Text style={{ color: colors.textFaint, fontSize: 11, textAlign: 'center', marginTop: 16, lineHeight: 16 }}>
            Built from live GetModuleMeasments records for your assigned sensors only.
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
