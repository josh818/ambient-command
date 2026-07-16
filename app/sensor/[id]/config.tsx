import { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Switch,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation } from 'convex/react';
import { colors } from '../../../src/constants/theme';
import { useSensor } from '../../../src/lib/sensorStore';
import { useSession } from '../../../lib/auth-client';
import { api } from '../../../convex/_generated/api';
import { sensorTypeMeta } from '../../../src/lib/mockData';
import { useSubscription } from '../../../src/lib/subscription';
import { PremiumGate } from '../../../src/components/PremiumGate';
import { notifySuccess, notifyError } from '../../../src/lib/notify';

type SettingDoc = {
  _id: string;
  sensorId: string;
  reportingInterval?: number;
  alertSensitivity?: string;
  minThreshold?: number;
  maxThreshold?: number;
  alertsEnabled?: boolean;
  ledIndicator?: boolean;
};

const intervals = [
  { label: '10s', value: 10 },
  { label: '30s', value: 30 },
  { label: '1m', value: 60 },
  { label: '5m', value: 300 },
];

const sensitivities = [
  { key: 'low', label: 'Low', desc: 'Fewer alerts' },
  { key: 'balanced', label: 'Balanced', desc: 'Recommended' },
  { key: 'high', label: 'High', desc: 'Most sensitive' },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View
      className="rounded-2xl p-5 mt-4"
      style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
    >
      <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 14 }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

export default function SensorConfig() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { sensor } = useSensor(id);
  const { data: session } = useSession();
  const { isPremium } = useSubscription();

  const settings = useQuery(
    api.queries.listSensorSettings,
    session ? {} : 'skip',
  ) as SettingDoc[] | undefined;
  const createSetting = useMutation(api.mutations.createSensorSetting);
  const updateSetting = useMutation(api.mutations.updateSensorSetting);

  const existing = useMemo(
    () => (settings ?? []).find((s) => s.sensorId === id),
    [settings, id],
  );

  const [reportingInterval, setReportingInterval] = useState(30);
  const [sensitivity, setSensitivity] = useState('balanced');
  const [minThreshold, setMinThreshold] = useState('');
  const [maxThreshold, setMaxThreshold] = useState('');
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [ledIndicator, setLedIndicator] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (existing) {
      setReportingInterval(existing.reportingInterval ?? 30);
      setSensitivity(existing.alertSensitivity ?? 'balanced');
      setMinThreshold(existing.minThreshold != null ? String(existing.minThreshold) : '');
      setMaxThreshold(existing.maxThreshold != null ? String(existing.maxThreshold) : '');
      setAlertsEnabled(existing.alertsEnabled ?? true);
      setLedIndicator(existing.ledIndicator ?? true);
    }
  }, [existing]);

  if (!sensor) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: colors.bg }}>
        <Text style={{ color: colors.textMuted }}>Sensor not found</Text>
      </SafeAreaView>
    );
  }

  const meta = sensorTypeMeta[sensor.type];
  const numeric = ['temperature', 'humidity', 'pressure'].includes(sensor.type);

  if (!isPremium) {
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
            Remote Configuration
          </Text>
        </View>
        <View className="flex-1 px-5 justify-center">
          <PremiumGate
            icon="options"
            title="Remote control is a Premium feature"
            description="Adjust reporting intervals, alert sensitivity, thresholds and device settings remotely with a Premium plan."
          />
        </View>
      </SafeAreaView>
    );
  }

  const save = async () => {
    setSaving(true);
    const payload = {
      reportingInterval,
      alertSensitivity: sensitivity,
      minThreshold: minThreshold.trim() ? Number(minThreshold) : undefined,
      maxThreshold: maxThreshold.trim() ? Number(maxThreshold) : undefined,
      alertsEnabled,
      ledIndicator,
      updatedAt: Date.now(),
    };
    try {
      if (existing) {
        await updateSetting({ id: existing._id as any, ...payload });
      } else {
        await createSetting({ sensorId: sensor.id, ...payload });
      }
      setSaved(true);
      notifySuccess('Configuration pushed', `${sensor.defaultName} updated`);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      notifyError('Push failed', e instanceof Error ? e.message : 'Could not reach device');
    } finally {
      setSaving(false);
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
            Remote Configuration
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-row items-center">
            <View
              className="w-11 h-11 rounded-xl items-center justify-center mr-3"
              style={{ backgroundColor: colors.surfaceAlt }}
            >
              <Ionicons name={meta.icon as any} size={22} color={colors.primary} />
            </View>
            <View className="flex-1">
              <Text style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>
                {sensor.defaultName}
              </Text>
              <Text style={{ color: colors.textFaint, fontSize: 12 }}>
                {sensor.location} · {sensor.id}
              </Text>
            </View>
          </View>

          {/* Reporting interval */}
          <Section title="Reporting Interval">
            <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 12 }}>
              How often this device transmits readings.
            </Text>
            <View className="flex-row gap-2">
              {intervals.map((iv) => {
                const active = reportingInterval === iv.value;
                return (
                  <Pressable
                    key={iv.value}
                    onPress={() => setReportingInterval(iv.value)}
                    className="flex-1 items-center py-3 rounded-xl"
                    style={{
                      backgroundColor: active ? colors.primary + '22' : colors.surfaceAlt,
                      borderWidth: 1,
                      borderColor: active ? colors.primary + '66' : colors.border,
                    }}
                  >
                    <Text
                      style={{
                        color: active ? colors.primary : colors.textMuted,
                        fontSize: 14,
                        fontWeight: '700',
                      }}
                    >
                      {iv.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Section>

          {/* Alert sensitivity */}
          <Section title="Alert Sensitivity">
            {sensitivities.map((s) => {
              const active = sensitivity === s.key;
              return (
                <Pressable
                  key={s.key}
                  onPress={() => setSensitivity(s.key)}
                  className="flex-row items-center py-3"
                  style={{ borderBottomWidth: s.key !== 'high' ? 1 : 0, borderBottomColor: colors.border }}
                >
                  <View
                    className="w-5 h-5 rounded-full items-center justify-center mr-3"
                    style={{
                      borderWidth: 2,
                      borderColor: active ? colors.primary : colors.textFaint,
                    }}
                  >
                    {active && (
                      <View
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: colors.primary }}
                      />
                    )}
                  </View>
                  <View className="flex-1">
                    <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>
                      {s.label}
                    </Text>
                    <Text style={{ color: colors.textFaint, fontSize: 12 }}>{s.desc}</Text>
                  </View>
                </Pressable>
              );
            })}
          </Section>

          {/* Thresholds (numeric sensors only) */}
          {numeric && (
            <Section title={`Threshold Range (${sensor.unit || 'value'})`}>
              <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 12 }}>
                Trigger an alert when readings fall outside this range.
              </Text>
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Text style={{ color: colors.textFaint, fontSize: 12, marginBottom: 6 }}>Minimum</Text>
                  <TextInput
                    value={minThreshold}
                    onChangeText={setMinThreshold}
                    keyboardType="numeric"
                    placeholder="—"
                    placeholderTextColor={colors.textFaint}
                    className="rounded-xl px-3 py-2.5"
                    style={{
                      backgroundColor: colors.surfaceAlt,
                      color: colors.text,
                      fontSize: 15,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  />
                </View>
                <View className="flex-1">
                  <Text style={{ color: colors.textFaint, fontSize: 12, marginBottom: 6 }}>Maximum</Text>
                  <TextInput
                    value={maxThreshold}
                    onChangeText={setMaxThreshold}
                    keyboardType="numeric"
                    placeholder="—"
                    placeholderTextColor={colors.textFaint}
                    className="rounded-xl px-3 py-2.5"
                    style={{
                      backgroundColor: colors.surfaceAlt,
                      color: colors.text,
                      fontSize: 15,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  />
                </View>
              </View>
            </Section>
          )}

          {/* Device toggles */}
          <Section title="Device Options">
            <View
              className="flex-row items-center justify-between py-3"
              style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}
            >
              <View className="flex-1 pr-3">
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>
                  Alerts enabled
                </Text>
                <Text style={{ color: colors.textFaint, fontSize: 12 }}>
                  Receive notifications from this sensor
                </Text>
              </View>
              <Switch
                value={alertsEnabled}
                onValueChange={setAlertsEnabled}
                trackColor={{ false: colors.surfaceAlt, true: colors.primaryDark }}
                thumbColor={alertsEnabled ? colors.primary : colors.textFaint}
              />
            </View>
            <View className="flex-row items-center justify-between py-3">
              <View className="flex-1 pr-3">
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>
                  LED indicator
                </Text>
                <Text style={{ color: colors.textFaint, fontSize: 12 }}>
                  Show the status light on the device
                </Text>
              </View>
              <Switch
                value={ledIndicator}
                onValueChange={setLedIndicator}
                trackColor={{ false: colors.surfaceAlt, true: colors.primaryDark }}
                thumbColor={ledIndicator ? colors.primary : colors.textFaint}
              />
            </View>
          </Section>
        </ScrollView>

        {/* Save bar */}
        <View
          className="px-5 pt-3"
          style={{
            paddingBottom: Platform.select({ web: 20, default: 32 }),
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.bg,
          }}
        >
          <Pressable
            onPress={save}
            disabled={saving}
            className="rounded-2xl py-4 items-center flex-row justify-center active:opacity-80"
            style={{ backgroundColor: saved ? colors.online : colors.primary, opacity: saving ? 0.7 : 1 }}
          >
            <Ionicons
              name={saved ? 'checkmark-circle' : 'cloud-upload'}
              size={18}
              color={colors.bg}
            />
            <Text style={{ color: colors.bg, fontSize: 16, fontWeight: '800', marginLeft: 8 }}>
              {saved ? 'Pushed to device' : saving ? 'Pushing…' : 'Apply Configuration'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
