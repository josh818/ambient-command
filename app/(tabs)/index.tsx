import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/constants/theme';
import { useSensors } from '../../src/lib/sensorStore';
import { useLiveData } from '../../src/lib/useLiveData';
import { SensorCard } from '../../src/components/SensorCard';
import { SmartAlertCard } from '../../src/components/AlertNotification';
import { useSmartAlerts } from '../../src/lib/alerts';
import { LiveApiData } from '../../src/components/LiveApiData';
import { QuickControls } from '../../src/components/QuickControls';
import { SceneShortcuts } from '../../src/components/SceneShortcuts';
import { useSubscription } from '../../src/lib/subscription';
import { PremiumBadge } from '../../src/components/PremiumGate';
import { HealthRing } from '../../src/components/HealthRing';
import { computeSystemHealth } from '../../src/lib/health';
import { NoDevicesAssigned } from '../../src/components/NoDevicesAssigned';
import { AmbientBackground } from '../../src/components/AmbientBackground';

function StatTile({
  icon,
  label,
  value,
  tint,
}: {
  icon: string;
  label: string;
  value: string;
  tint: string;
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
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: colors.textFaint, fontSize: 12, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const { sensors: stored, noDevicesAssigned, access } = useSensors();
  const { liveSensors: sensors, pulse } = useLiveData(stored);
  const { alerts, counts, allAlerts } = useSmartAlerts(sensors);
  const { isPremium, limits } = useSubscription();
  // Health always reflects every evaluated alert — notification muting only
  // hides alerts from the alert center, it never changes system health.
  const health = computeSystemHealth(sensors, allAlerts);

  // Account has no devices assigned — keep the header, show the designed
  // empty state instead of health/stats/sensor sections.
  if (noDevicesAssigned) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: 'transparent' }} edges={[]}>
        <AmbientBackground />
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-row items-center justify-between mb-1">
            <View>
              <Text style={{ color: colors.textFaint, fontSize: 13 }}>BH Sensors</Text>
              <Text style={{ color: colors.text, fontSize: 26, fontWeight: '800' }}>
                Ambient Command
              </Text>
            </View>
          </View>
          <View className="mt-4">
            <NoDevicesAssigned email={access.userEmail} />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const handleHealthPress = () => {
    if (health.problemCount > 0) {
      // Jump straight to the problem sensors, pre-filtered by the dominant
      // issue (warnings first, then offline units).
      const hasWarning = sensors.some((s) => s.status === 'warning');
      const target = hasWarning ? 'warning' : 'offline';
      router.push({ pathname: '/(tabs)/sensors', params: { filter: target } });
    } else if (counts.total > 0) {
      router.push('/(tabs)/alerts');
    } else {
      router.push('/(tabs)/sensors');
    }
  };

  const visibleSensors = isPremium ? sensors : sensors.slice(0, limits.maxSensors);
  const hiddenCount = sensors.length - visibleSensors.length;

  const stats = {
    online: sensors.filter((s) => s.status === 'online').length,
    warning: sensors.filter((s) => s.status === 'warning').length,
    offline: sensors.filter((s) => s.status === 'offline').length,
    total: sensors.length,
  };

  const topAlerts = alerts.slice(0, 3);

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: 'transparent' }} edges={[]}>
      <AmbientBackground />
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row items-center justify-between mb-1">
          <View>
            <Text style={{ color: colors.textFaint, fontSize: 13 }}>BH Sensors</Text>
            <Text style={{ color: colors.text, fontSize: 26, fontWeight: '800' }}>
              Ambient Command
            </Text>
          </View>
          <View
            className="flex-row items-center px-3 py-1.5 rounded-full"
            style={{
              backgroundColor: 'rgba(126,226,190,0.12)',
              // Soft mint glow — live/positive state
              shadowColor: colors.primary,
              shadowOpacity: 0.4,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 0 },
            }}
          >
            <View
              className="w-2 h-2 rounded-full mr-1.5"
              style={{ backgroundColor: colors.online, opacity: pulse ? 0.4 : 1 }}
            />
            <Text style={{ color: colors.online, fontSize: 12, fontWeight: '700' }}>Live</Text>
          </View>
        </View>

        {/* System health hero */}
        <View className="mt-4">
          <HealthRing health={health} onPress={handleHealthPress} />
        </View>



        <View className="flex-row gap-3 mt-4">
          <StatTile icon="checkmark-circle" label="Online" value={`${stats.online}`} tint={colors.online} />
          <StatTile icon="alert-circle" label="Warnings" value={`${stats.warning}`} tint={colors.warning} />
          <StatTile icon="close-circle" label="Offline" value={`${stats.offline}`} tint={colors.offline} />
        </View>

        <View className="mt-6">
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 12 }}>
            Quick Controls
          </Text>
          <QuickControls />
        </View>

        {/* Analytics & timeline shortcuts */}
        <View className="flex-row mt-4" style={{ gap: 14 }}>
          <Pressable
            onPress={() => router.push('/usage')}
            className="flex-1 rounded-2xl p-4 active:opacity-90"
            style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
          >
            <View
              className="w-9 h-9 rounded-xl items-center justify-center mb-2.5"
              style={{ backgroundColor: 'rgba(126,226,190,0.15)' }}
            >
              <Ionicons name="bar-chart" size={18} color={colors.primary} />
            </View>
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>Water Usage</Text>
            <Text style={{ color: colors.textFaint, fontSize: 12, marginTop: 2 }}>
              Trends & conservation goal
            </Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/events')}
            className="flex-1 rounded-2xl p-4 active:opacity-90"
            style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
          >
            <View
              className="w-9 h-9 rounded-xl items-center justify-center mb-2.5"
              style={{ backgroundColor: 'rgba(129,140,248,0.15)' }}
            >
              <Ionicons name="time" size={18} color={colors.accent} />
            </View>
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>Timeline</Text>
            <Text style={{ color: colors.textFaint, fontSize: 12, marginTop: 2 }}>
              Incidents & event history
            </Text>
          </Pressable>
        </View>

        {!isPremium && (
          <Pressable
            onPress={() => router.push('/settings/subscription')}
            className="mt-6 rounded-2xl p-4 flex-row items-center active:opacity-90"
            style={{ backgroundColor: 'rgba(126,226,190,0.10)', borderWidth: 1, borderColor: colors.primary + '40' }}
          >
            <Ionicons name="notifications-off" size={20} color={colors.primary} />
            <View className="flex-1 ml-3">
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>
                Smart Alerts are Premium
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2, lineHeight: 17 }}>
                Unlock real-time leak, freeze & offline detection.
              </Text>
            </View>
            <PremiumBadge />
          </Pressable>
        )}

        {isPremium && topAlerts.length > 0 && (
          <View className="mt-6">
            <View className="flex-row items-center mb-3">
              <Ionicons name="notifications" size={16} color={colors.danger} />
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginLeft: 8 }}>
                Smart Alerts
              </Text>
              <View
                className="ml-2 px-2 py-0.5 rounded-full"
                style={{ backgroundColor: 'rgba(224,114,89,0.15)' }}
              >
                <Text style={{ color: colors.danger, fontSize: 11, fontWeight: '700' }}>
                  {counts.total}
                </Text>
              </View>
              <Pressable
                className="ml-auto flex-row items-center"
                onPress={() => router.push('/(tabs)/alerts')}
              >
                <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>View all</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.primary} />
              </Pressable>
            </View>
            {topAlerts.map((a) => (
              <SmartAlertCard key={a.id} alert={a} onPress={() => router.push('/(tabs)/alerts')} />
            ))}
          </View>
        )}

        <Pressable
          onPress={() => router.push('/(tabs)/console')}
          className="mt-6 rounded-2xl p-4 flex-row items-center active:opacity-90"
          style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
        >
          <View
            className="w-10 h-10 rounded-xl items-center justify-center"
            style={{ backgroundColor: 'rgba(126,226,190,0.15)' }}
          >
            <Ionicons name="terminal" size={20} color={colors.primary} />
          </View>
          <View className="flex-1 ml-3">
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>
              Command Console
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2, lineHeight: 17 }}>
              Control the sensor mesh with text commands
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
        </Pressable>

        <View className="mt-6">
          <SceneShortcuts />
        </View>



        <View className="mt-6">
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 12 }}>
            All Sensors
          </Text>
          {visibleSensors.map((s) => (
            <SensorCard key={s.id} sensor={s} />
          ))}
          {hiddenCount > 0 && (
            <Pressable
              onPress={() => router.push('/settings/subscription')}
              className="rounded-2xl p-4 items-center active:opacity-90"
              style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary + '40', borderStyle: 'dashed' }}
            >
              <Ionicons name="lock-closed" size={20} color={colors.primary} />
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700', marginTop: 6 }}>
                {hiddenCount} more {hiddenCount === 1 ? 'sensor' : 'sensors'} hidden
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2, textAlign: 'center' }}>
                Free plan monitors {limits.maxSensors} sensors. Upgrade to see all.
              </Text>
            </Pressable>
          )}
        </View>
        <View className="mt-6">
          <LiveApiData />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
