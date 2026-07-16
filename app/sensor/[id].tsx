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
} from '../../src/lib/mockData';
import { StatusPill } from '../../src/components/StatusPill';
import { LiveModuleData } from '../../src/components/LiveModuleData';

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
