import { useState } from 'react';
import { View, Text, ScrollView, Pressable, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors } from '../../src/constants/theme';
import { usePreferences, type Preferences } from '../../src/lib/preferencesStore';
import {
  useNotificationPrefs,
  isInQuietHours,
  formatHour,
  type NotificationPrefs,
} from '../../src/lib/notificationPrefs';

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

function HourStepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (h: number) => void;
}) {
  return (
    <View className="flex-1 items-center rounded-xl py-3" style={{ backgroundColor: colors.surfaceAlt }}>
      <Text style={{ color: colors.textFaint, fontSize: 11, fontWeight: '700', letterSpacing: 0.6 }}>
        {label}
      </Text>
      <View className="flex-row items-center" style={{ marginTop: 8, gap: 14 }}>
        <Pressable
          onPress={() => onChange((value + 23) % 24)}
          className="w-8 h-8 rounded-lg items-center justify-center active:opacity-70"
          style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
          accessibilityLabel={`${label} earlier`}
        >
          <Ionicons name="remove" size={16} color={colors.text} />
        </Pressable>
        <Text
          style={{
            color: colors.text,
            fontSize: 15,
            fontWeight: '800',
            minWidth: 74,
            textAlign: 'center',
            fontVariant: ['tabular-nums'],
          }}
        >
          {formatHour(value)}
        </Text>
        <Pressable
          onPress={() => onChange((value + 1) % 24)}
          className="w-8 h-8 rounded-lg items-center justify-center active:opacity-70"
          style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
          accessibilityLabel={`${label} later`}
        >
          <Ionicons name="add" size={16} color={colors.text} />
        </Pressable>
      </View>
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
  const { prefs: cloudPrefs, save } = useNotificationPrefs();

  // Optimistic overlay so switches respond instantly while the Convex
  // mutation round-trips; the live query converges to the same values.
  const [override, setOverride] = useState<Partial<NotificationPrefs>>({});
  const notif: NotificationPrefs = { ...cloudPrefs, ...override };

  const setNotif = <K extends keyof NotificationPrefs>(key: K, value: NotificationPrefs[K]) => {
    setOverride((o) => ({ ...o, [key]: value }));
    void save({ [key]: value });
  };

  const toggle = (key: keyof Preferences) => (v: boolean) => {
    void setPref(key, v as never);
  };

  const quietNow = isInQuietHours(notif);

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
            sub="Critical leak alerts always surface"
            tint={colors.accent}
            value={notif.leak}
            onValueChange={(v) => setNotif('leak', v)}
          />
          <ToggleRow
            icon="cloud-offline-outline"
            label="Connectivity Alerts"
            sub="Sensor offline & weak-signal warnings"
            tint={colors.warning}
            value={notif.connectivity}
            onValueChange={(v) => setNotif('connectivity', v)}
          />
          <ToggleRow
            icon="battery-half-outline"
            label="Battery Alerts"
            sub="Low & critical battery warnings"
            tint={colors.warning}
            value={notif.battery}
            onValueChange={(v) => setNotif('battery', v)}
          />
          <ToggleRow
            icon="speedometer-outline"
            label="High-Usage Alerts"
            sub="When usage runs ahead of your goal"
            tint={colors.primary}
            value={notif.usage}
            onValueChange={(v) => setNotif('usage', v)}
            last
          />
        </View>

        <SectionLabel>Quiet Hours</SectionLabel>
        <View
          className="rounded-2xl overflow-hidden"
          style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
        >
          <ToggleRow
            icon="moon-outline"
            label="Quiet Hours"
            sub={
              notif.quietHoursEnabled
                ? `Non-critical alerts held ${formatHour(notif.quietHoursStart)} – ${formatHour(
                    notif.quietHoursEnd,
                  )}${quietNow ? ' · active now' : ''}`
                : 'Suppress non-critical alerts overnight'
            }
            tint={colors.accent}
            value={notif.quietHoursEnabled}
            onValueChange={(v) => setNotif('quietHoursEnabled', v)}
            last={!notif.quietHoursEnabled}
          />
          {notif.quietHoursEnabled && (
            <View style={{ padding: 16, paddingTop: 4 }}>
              <View className="flex-row" style={{ gap: 14 }}>
                <HourStepper
                  label="STARTS"
                  value={notif.quietHoursStart}
                  onChange={(h) => setNotif('quietHoursStart', h)}
                />
                <HourStepper
                  label="ENDS"
                  value={notif.quietHoursEnd}
                  onChange={(h) => setNotif('quietHoursEnd', h)}
                />
              </View>
              <View className="flex-row items-start" style={{ marginTop: 12 }}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={14}
                  color={colors.textFaint}
                  style={{ marginTop: 1 }}
                />
                <Text style={{ color: colors.textFaint, fontSize: 11, marginLeft: 6, flex: 1, lineHeight: 16 }}>
                  During quiet hours, warnings and info alerts are held. Critical alerts — including
                  active water leaks — always break through.
                </Text>
              </View>
            </View>
          )}
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
          Alert notifications & quiet hours sync to your account. Delivery and display settings are
          saved on this device.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
