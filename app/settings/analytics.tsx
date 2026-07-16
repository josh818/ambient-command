import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors } from '../../src/constants/theme';
import { useAnalytics } from '../../src/lib/analytics';

function MetricCard({
  icon,
  label,
  value,
  tint,
  sub,
}: {
  icon: string;
  label: string;
  value: string;
  tint: string;
  sub?: string;
}) {
  return (
    <View
      className="flex-1 rounded-2xl p-4"
      style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
    >
      <View
        className="w-9 h-9 rounded-xl items-center justify-center mb-2.5"
        style={{ backgroundColor: tint + '22' }}
      >
        <Ionicons name={icon as any} size={18} color={tint} />
      </View>
      <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: colors.textFaint, fontSize: 12, marginTop: 2 }}>{label}</Text>
      {sub && <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 1 }}>{sub}</Text>}
    </View>
  );
}

export default function AnalyticsScreen() {
  const router = useRouter();
  const { insights, revenueModel, totalEvents, reset } = useAnalytics();

  const maxDemand = Math.max(1, ...insights.map((i) => i.demand));
  const rm = revenueModel;

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
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginLeft: 12 }}>
          Usage Analytics
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 16, lineHeight: 19 }}>
          Feature engagement and upgrade-intent signals used to model revenue and balance the
          premium tier.
        </Text>

        {/* Revenue projection hero */}
        <View
          className="rounded-3xl p-5"
          style={{
            backgroundColor: 'rgba(45,212,191,0.10)',
            borderWidth: 1,
            borderColor: colors.primary + '55',
          }}
        >
          <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '800', letterSpacing: 0.5 }}>
            PROJECTED MRR
          </Text>
          <Text style={{ color: colors.text, fontSize: 34, fontWeight: '800', marginTop: 4 }}>
            ${rm.projectedMrr.toFixed(2)}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>
            Modeled from {rm.totalGateHits} upgrade-intent {rm.totalGateHits === 1 ? 'signal' : 'signals'} at $4.99/mo
          </Text>
        </View>

        {/* Funnel metrics */}
        <View className="flex-row gap-3 mt-4">
          <MetricCard
            icon="eye"
            label="Upgrade views"
            value={`${rm.upgradeViewed}`}
            tint={colors.accent}
          />
          <MetricCard
            icon="cart"
            label="Checkout starts"
            value={`${rm.upgradeStarted}`}
            tint={colors.primary}
            sub={`${rm.viewToStartRate}% of views`}
          />
        </View>

        <View className="flex-row gap-3 mt-3">
          <MetricCard
            icon="lock-closed"
            label="Gate hits"
            value={`${rm.totalGateHits}`}
            tint={colors.warning}
          />
          <MetricCard
            icon="pulse"
            label="Total events"
            value={`${totalEvents}`}
            tint={colors.online}
          />
        </View>

        {/* Top driver */}
        {rm.topDriver && (
          <View
            className="rounded-2xl p-4 mt-4 flex-row items-center"
            style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
          >
            <View
              className="w-11 h-11 rounded-xl items-center justify-center mr-3"
              style={{ backgroundColor: colors.primary + '22' }}
            >
              <Ionicons name={rm.topDriver.icon as any} size={22} color={colors.primary} />
            </View>
            <View className="flex-1">
              <Text style={{ color: colors.textFaint, fontSize: 11 }}>Top upgrade driver</Text>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', marginTop: 1 }}>
                {rm.topDriver.label}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 1 }}>
                {rm.topDriver.gateHits} gate {rm.topDriver.gateHits === 1 ? 'hit' : 'hits'} from free users
              </Text>
            </View>
          </View>
        )}

        {/* Feature demand breakdown */}
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 24, marginBottom: 12 }}>
          Feature Demand
        </Text>
        <View
          className="rounded-2xl p-4"
          style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
        >
          {insights.map((f, idx) => (
            <View key={f.feature} style={{ marginTop: idx === 0 ? 0 : 16 }}>
              <View className="flex-row items-center justify-between mb-1.5">
                <View className="flex-row items-center flex-1">
                  <Ionicons name={f.icon as any} size={15} color={f.isPremium ? colors.primary : colors.textMuted} />
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600', marginLeft: 7 }}>
                    {f.label}
                  </Text>
                  {f.isPremium && (
                    <View
                      className="ml-2 px-1.5 rounded-full"
                      style={{ backgroundColor: 'rgba(45,212,191,0.15)' }}
                    >
                      <Text style={{ color: colors.primary, fontSize: 9, fontWeight: '800' }}>PRO</Text>
                    </View>
                  )}
                </View>
                <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700' }}>
                  {f.demand}
                </Text>
              </View>
              <View
                className="h-2 rounded-full overflow-hidden"
                style={{ backgroundColor: colors.surfaceAlt }}
              >
                <View
                  className="h-2 rounded-full"
                  style={{
                    width: `${Math.round((f.demand / maxDemand) * 100)}%`,
                    backgroundColor: f.isPremium ? colors.primary : colors.accent,
                  }}
                />
              </View>
              {f.isPremium && f.gateHits > 0 && (
                <Text style={{ color: colors.textFaint, fontSize: 11, marginTop: 3 }}>
                  {f.gateHits} blocked · {f.uses} used
                </Text>
              )}
            </View>
          ))}
        </View>

        <Pressable
          onPress={() => void reset()}
          className="rounded-2xl mt-5 py-3.5 items-center flex-row justify-center active:opacity-80"
          style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
        >
          <Ionicons name="refresh" size={16} color={colors.textMuted} />
          <Text style={{ color: colors.textMuted, fontSize: 14, fontWeight: '600', marginLeft: 8 }}>
            Reset Analytics Data
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
