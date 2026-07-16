import { View, Text, ScrollView, Pressable, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors } from '../../src/constants/theme';
import { usePreferences, type Preferences } from '../../src/lib/preferencesStore';

function ToggleRow({
  icon,
  label,
  sub,
  value,
  onValueChange,
  tint = colors.textMuted,
  last,
}: {
  icon: string;
  label: string;
  sub?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  tint?: string;
  last?: boolean;
}) {
  return (
    <View
      className="flex-row items-center px-4 py-3.5"
      style={last ? undefined : { borderBottomWidth: 1, borderBottomColor: colors.border }}
    >
      <View
        className="w-9 h-9 rounded-xl items-center justify-center mr-3"
        style={{ backgroundColor: colors.surfaceAlt }}
      >
        <Ionicons name={icon as any} size={18} color={tint} />
      </View>
      <View className="flex-1 mr-2">
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>{label}</Text>
        {sub && <Text style={{ color: colors.textFaint, fontSize: 12, marginTop: 1 }}>{sub}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.surfaceAlt, true: colors.primary }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text
      style={{
        color: colors.textFaint,
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.5,
        marginBottom: 8,
        marginTop: 20,
        textTransform: 'uppercase',
      }}
    >
      {children}
    </Text>
  );
}

export default function PreferencesScreen() {
  const router = useRouter();
  const { prefs, setPref, reset } = usePreferences();

  const toggle = (key: keyof Preferences) => (v: boolean) => {
    void setPref(key, v as never);
  };

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
          Preferences
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <SectionLabel>Alert Notifications</SectionLabel>
        <View
          className="rounded-2xl overflow-hidden"
          style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
        >
          <ToggleRow
            icon="water-outline"
            label="Leak Alerts"
            sub="Notify on water detection"
            tint={colors.accent}
            value={prefs.leakAlerts}
            onValueChange={toggle('leakAlerts')}
          />
          <ToggleRow
            icon="snow-outline"
            label="Freeze Alerts"
            sub="Warn on freezing temperatures"
            tint={colors.accent}
            value={prefs.freezeAlerts}
            onValueChange={toggle('freezeAlerts')}
          />
          <ToggleRow
            icon="cloud-offline-outline"
            label="Offline Alerts"
            sub="Notify when a sensor drops off"
            tint={colors.warning}
            value={prefs.offlineAlerts}
            onValueChange={toggle('offlineAlerts')}
          />
          <ToggleRow
            icon="battery-half-outline"
            label="Low Battery Alerts"
            sub="Warn below 20% battery"
            tint={colors.warning}
            value={prefs.batteryAlerts}
            onValueChange={toggle('batteryAlerts')}
            last
          />
        </View>

        <SectionLabel>Delivery</SectionLabel>
        <View
          className="rounded-2xl overflow-hidden"
          style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
        >
          <ToggleRow
            icon="notifications-outline"
            label="Push Notifications"
            sub="Receive alerts on this device"
            tint={colors.primary}
            value={prefs.pushEnabled}
            onValueChange={toggle('pushEnabled')}
          />
          <ToggleRow
            icon="phone-portrait-outline"
            label="Haptic Feedback"
            sub="Vibrate on key actions"
            value={prefs.haptics}
            onValueChange={toggle('haptics')}
            last
          />
        </View>

        <SectionLabel>Display</SectionLabel>
        <View
          className="rounded-2xl overflow-hidden"
          style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
        >
          <View
            className="flex-row items-center px-4 py-3.5"
            style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}
          >
            <View
              className="w-9 h-9 rounded-xl items-center justify-center mr-3"
              style={{ backgroundColor: colors.surfaceAlt }}
            >
              <Ionicons name="thermometer-outline" size={18} color={colors.primary} />
            </View>
            <View className="flex-1 mr-2">
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>
                Temperature Unit
              </Text>
              <Text style={{ color: colors.textFaint, fontSize: 12, marginTop: 1 }}>
                Used across readings & charts
              </Text>
            </View>
            <View className="flex-row rounded-lg overflow-hidden" style={{ borderWidth: 1, borderColor: colors.border }}>
              {(['C', 'F'] as const).map((u) => {
                const active = prefs.temperatureUnit === u;
                return (
                  <Pressable
                    key={u}
                    onPress={() => void setPref('temperatureUnit', u)}
                    className="px-4 py-1.5 active:opacity-70"
                    style={{ backgroundColor: active ? colors.primary : 'transparent' }}
                  >
                    <Text
                      style={{
                        color: active ? colors.bg : colors.textMuted,
                        fontSize: 14,
                        fontWeight: '700',
                      }}
                    >
                      °{u}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <ToggleRow
            icon="pulse-outline"
            label="Live Updates"
            sub="Stream real-time telemetry"
            tint={colors.online}
            value={prefs.liveUpdates}
            onValueChange={toggle('liveUpdates')}
            last
          />
        </View>

        <Pressable
          onPress={() => void reset()}
          className="rounded-2xl mt-6 py-4 items-center flex-row justify-center active:opacity-80"
          style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
        >
          <Ionicons name="refresh-outline" size={18} color={colors.textMuted} />
          <Text style={{ color: colors.textMuted, fontSize: 15, fontWeight: '600', marginLeft: 8 }}>
            Reset to Defaults
          </Text>
        </Pressable>

        <Text style={{ color: colors.textFaint, fontSize: 12, textAlign: 'center', marginTop: 20 }}>
          Preferences are saved on this device.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
