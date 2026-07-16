import { useState } from 'react';
import { View, Text, Switch, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors } from '../constants/theme';
import { sensorTypeMeta } from '../lib/mockData';
import { useSensors } from '../lib/sensorStore';

export function QuickControls() {
  const router = useRouter();
  const { sensors, toggleSensor } = useSensors();
  const controllable = sensors.filter((s) => s.controllable);
  const [pending, setPending] = useState<Record<string, boolean>>({});

  if (controllable.length === 0) return null;

  const NotConnectedNote = (
    <View
      className="flex-row items-start px-4 py-2.5"
      style={{ backgroundColor: colors.surfaceAlt, borderBottomWidth: 1, borderBottomColor: colors.border }}
    >
      <Ionicons name="information-circle-outline" size={13} color={colors.textFaint} style={{ marginTop: 1 }} />
      <Text style={{ color: colors.textFaint, fontSize: 10.5, marginLeft: 5, flex: 1, lineHeight: 14 }}>
        These switches aren't wired to the physical valves yet — they only save a setting in the app.
      </Text>
    </View>
  );

  const handleToggle = async (id: string, value: boolean) => {
    setPending((p) => ({ ...p, [id]: true }));
    try {
      await toggleSensor(id, value);
    } finally {
      setPending((p) => {
        const next = { ...p };
        delete next[id];
        return next;
      });
    }
  };

  return (
    <View
      className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
    >
      {NotConnectedNote}
      {controllable.map((s, i) => {
        const meta = sensorTypeMeta[s.type];
        const isPending = !!pending[s.id];
        const disabled = s.status === 'offline' || isPending;
        return (
          <View
            key={s.id}
            className="flex-row items-center px-4 py-3.5"
            style={{
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: colors.border,
              opacity: s.status === 'offline' ? 0.5 : 1,
            }}
          >
            <Pressable
              onPress={() => router.push(`/sensor/${s.id}`)}
              className="flex-row items-center flex-1 active:opacity-70"
            >
              <View
                className="w-9 h-9 rounded-xl items-center justify-center mr-3"
                style={{ backgroundColor: colors.surfaceAlt }}
              >
                <Ionicons
                  name={meta.icon as any}
                  size={18}
                  color={s.isOn ? colors.primary : colors.textFaint}
                />
              </View>
              <View className="flex-1">
                <Text numberOfLines={1} style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>
                  {s.defaultName}
                </Text>
                <Text style={{ color: colors.textFaint, fontSize: 11, marginTop: 1 }}>
                  {s.location} · {isPending ? 'Saving…' : s.isOn ? 'Set: Open' : 'Set: Shut'}
                </Text>
              </View>
            </Pressable>
            {isPending ? (
              <View className="w-[51px] items-center justify-center">
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : (
              <Switch
                value={s.isOn}
                onValueChange={(v) => void handleToggle(s.id, v)}
                disabled={disabled}
                trackColor={{ false: colors.surfaceAlt, true: colors.primaryDark }}
                thumbColor={s.isOn ? colors.primary : colors.textFaint}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}
