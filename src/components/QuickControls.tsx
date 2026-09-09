import { useState } from 'react';
import { View, Text, Switch, Pressable, ActivityIndicator, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors } from '../constants/theme';
import { sensorTypeMeta } from '../lib/mockData';
import { useSensors } from '../lib/sensorStore';

type Pending = { id: string; name: string; open: boolean };

export function QuickControls() {
  const router = useRouter();
  const { sensors, commandValve } = useSensors();
  const controllable = sensors.filter((s) => s.controllable);
  const [pending, setPending] = useState<Pending | null>(null);
  const [sending, setSending] = useState(false);

  if (controllable.length === 0) return null;

  const HardwareNote = (
    <View
      className="flex-row items-start px-4 py-2.5"
      style={{ backgroundColor: colors.surfaceAlt, borderBottomWidth: 1, borderBottomColor: colors.border }}
    >
      <Ionicons name="water-outline" size={13} color={colors.primary} style={{ marginTop: 1 }} />
      <Text style={{ color: colors.textFaint, fontSize: 10.5, marginLeft: 5, flex: 1, lineHeight: 14 }}>
        These send a real open/close command to the valve. Commands queue and apply the next time
        the module checks in, so the switch shows the requested state, not an instant change.
      </Text>
    </View>
  );

  const confirmSend = async () => {
    if (!pending) return;
    setSending(true);
    try {
      await commandValve(pending.id, pending.open);
    } catch {
      // notify already fired in the store
    } finally {
      setSending(false);
      setPending(null);
    }
  };

  return (
    <View
      className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
    >
      {HardwareNote}
      {controllable.map((s, i) => {
        const meta = sensorTypeMeta[s.type];
        const isTarget = pending?.id === s.id && sending;
        const disabled = s.status === 'offline' || isTarget;
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
                  {s.location} · {isTarget ? 'Sending…' : s.isOn ? 'Set: Open' : 'Set: Shut'}
                </Text>
              </View>
            </Pressable>
            {isTarget ? (
              <View className="w-[51px] items-center justify-center">
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : (
              <Switch
                value={s.isOn}
                onValueChange={(v) => setPending({ id: s.id, name: s.defaultName, open: v })}
                disabled={disabled}
                trackColor={{ false: colors.surfaceAlt, true: colors.primaryDark }}
                thumbColor={s.isOn ? colors.primary : colors.textFaint}
              />
            )}
          </View>
        );
      })}

      {/* Confirmation — closing water is destructive, name the device + action */}
      <Modal visible={!!pending} transparent animationType="fade" onRequestClose={() => setPending(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 }}>
          <View
            style={{ backgroundColor: colors.surfaceAlt, borderRadius: 20, padding: 22, borderWidth: 1, borderColor: colors.border }}
          >
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>
              {pending?.open ? 'Open the water valve?' : 'Close the water valve?'}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 8, lineHeight: 20 }}>
              {pending?.open
                ? 'Water flow will be restored the next time this module checks in.'
                : 'This shuts off water at this device the next time the module checks in. Anything downstream will lose supply.'}
            </Text>
            <View
              className="rounded-xl mt-4 px-3 py-2.5"
              style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
            >
              <Text style={{ color: colors.textFaint, fontSize: 11 }}>Device</Text>
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700', marginTop: 1 }}>
                {pending?.name}
              </Text>
            </View>
            <View className="flex-row" style={{ gap: 12, marginTop: 20 }}>
              <Pressable
                onPress={() => setPending(null)}
                disabled={sending}
                className="flex-1 items-center justify-center active:opacity-80"
                style={{ minHeight: 50, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
              >
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => void confirmSend()}
                disabled={sending}
                className="flex-1 items-center justify-center active:opacity-90"
                style={{ minHeight: 50, borderRadius: 14, backgroundColor: pending?.open ? colors.online : colors.danger }}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#04201c" />
                ) : (
                  <Text style={{ color: '#04201c', fontSize: 15, fontWeight: '800' }}>
                    {pending?.open ? 'Confirm' : 'Close Water'}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
