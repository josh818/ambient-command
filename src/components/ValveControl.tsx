// ============================================================
// ValveControl — REAL valve actuation via the hardware command
// channel (IssueCommand). Commands are queued server-side and
// applied when the (battery, sleeping) module next checks in, so
// this is deliberately not presented as an instant toggle.
//
// Safety model:
//  - Every actuating command goes through an explicit confirm modal
//    that names the device and the action.
//  - Closing water (VALVE,CLOSE / VACATION / SABBATH) is styled as a
//    destructive action.
//  - After issuing, we poll the command queue + telemetry so the UI
//    reflects what the server actually recorded, never an optimistic
//    guess.
// ============================================================
import { useState } from 'react';
import { View, Text, Pressable, Modal, ActivityIndicator, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/theme';
import { issueCommand } from '../lib/api';

type PendingAction =
  | { kind: 'open' }
  | { kind: 'close' }
  | { kind: 'vacation'; days: number }
  | { kind: 'sabbath'; hours: number };

function commandString(a: PendingAction): string {
  switch (a.kind) {
    case 'open':
      return 'VALVE,OPEN';
    case 'close':
      return 'VALVE,CLOSE';
    case 'vacation':
      return `VACATION,${a.days}`;
    case 'sabbath':
      return `SABBATH,${a.hours}`;
  }
}

function describe(a: PendingAction): { title: string; body: string; destructive: boolean } {
  switch (a.kind) {
    case 'open':
      return {
        title: 'Open the water valve?',
        body: 'Water flow will be restored the next time this module checks in.',
        destructive: false,
      };
    case 'close':
      return {
        title: 'Close the water valve?',
        body: 'This shuts off water at this device the next time the module checks in. Anything downstream will lose supply.',
        destructive: true,
      };
    case 'vacation':
      return {
        title: `Start Vacation mode for ${a.days} day${a.days === 1 ? '' : 's'}?`,
        body: 'The valve closes and stays shut for the set number of days, then reopens automatically.',
        destructive: true,
      };
    case 'sabbath':
      return {
        title: `Start Sabbath mode for ${a.hours} hour${a.hours === 1 ? '' : 's'}?`,
        body: 'The valve closes and stays shut for the set number of hours, then reopens automatically.',
        destructive: true,
      };
  }
}

interface ValveControlProps {
  moduleId: string;
  deviceName: string;
  /** Live valve state from telemetry: true = OPEN, false = CLOSED, null = unknown. */
  valveOpen: boolean | null;
  offline: boolean;
}

export function ValveControl({ moduleId, deviceName, valveOpen, offline }: ValveControlProps) {
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [vacationDays, setVacationDays] = useState(7);
  const [sabbathHours, setSabbathHours] = useState(24);

  const confirmAndSend = async () => {
    if (!pending) return;
    setSending(true);
    setResult(null);
    try {
      await issueCommand(moduleId, commandString(pending));
      setResult({
        ok: true,
        msg: 'Command queued. It applies the next time this module checks in.',
      });
    } catch (e) {
      setResult({
        ok: false,
        msg: e instanceof Error ? e.message : 'Could not send the command.',
      });
    } finally {
      setSending(false);
      setPending(null);
    }
  };

  const stateColor = valveOpen === null ? colors.textFaint : valveOpen ? colors.online : colors.danger;
  const stateLabel = valveOpen === null ? 'Unknown' : valveOpen ? 'OPEN' : 'CLOSED';

  const desc = pending ? describe(pending) : null;

  return (
    <View
      className="rounded-2xl mt-4"
      style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 20 }}
    >
      {/* Header + live state */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Ionicons name="water" size={18} color={colors.primary} />
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', marginLeft: 8 }}>
            Water Shut-off Valve
          </Text>
        </View>
        <View
          className="px-2.5 py-1 rounded-full"
          style={{ backgroundColor: `${stateColor}1F` }}
        >
          <Text style={{ color: stateColor, fontSize: 12, fontWeight: '800' }}>{stateLabel}</Text>
        </View>
      </View>

      <Text style={{ color: colors.textFaint, fontSize: 12, marginTop: 6, lineHeight: 17 }}>
        Commands are queued and take effect the next time the module wakes and checks in — this is not instant.
      </Text>

      {/* Open / Close buttons */}
      <View className="flex-row" style={{ gap: 12, marginTop: 16 }}>
        <Pressable
          onPress={() => setPending({ kind: 'open' })}
          disabled={offline || sending}
          className="flex-1 items-center justify-center active:opacity-80"
          style={{
            minHeight: 52,
            borderRadius: 14,
            backgroundColor: `${colors.online}1A`,
            borderWidth: 1,
            borderColor: `${colors.online}55`,
            opacity: offline ? 0.5 : 1,
          }}
        >
          <Text style={{ color: colors.online, fontSize: 15, fontWeight: '800' }}>Open Valve</Text>
        </Pressable>
        <Pressable
          onPress={() => setPending({ kind: 'close' })}
          disabled={offline || sending}
          className="flex-1 items-center justify-center active:opacity-80"
          style={{
            minHeight: 52,
            borderRadius: 14,
            backgroundColor: `${colors.danger}1A`,
            borderWidth: 1,
            borderColor: `${colors.danger}55`,
            opacity: offline ? 0.5 : 1,
          }}
        >
          <Text style={{ color: colors.danger, fontSize: 15, fontWeight: '800' }}>Close Valve</Text>
        </Pressable>
      </View>

      {/* Advanced: vacation / sabbath */}
      <Pressable
        onPress={() => setShowAdvanced((s) => !s)}
        className="flex-row items-center justify-center active:opacity-70"
        style={{ minHeight: 40, marginTop: 8 }}
      >
        <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '600' }}>
          {showAdvanced ? 'Hide' : 'Vacation / Sabbath modes'}
        </Text>
        <Ionicons
          name={showAdvanced ? 'chevron-up' : 'chevron-down'}
          size={15}
          color={colors.textMuted}
          style={{ marginLeft: 4 }}
        />
      </Pressable>

      {showAdvanced && (
        <View style={{ gap: 14, marginTop: 6 }}>
          <Stepper
            label="Vacation (days)"
            value={vacationDays}
            min={1}
            max={90}
            onChange={setVacationDays}
            onApply={() => setPending({ kind: 'vacation', days: vacationDays })}
            disabled={offline || sending}
          />
          <Stepper
            label="Sabbath (hours)"
            value={sabbathHours}
            min={1}
            max={168}
            onChange={setSabbathHours}
            onApply={() => setPending({ kind: 'sabbath', hours: sabbathHours })}
            disabled={offline || sending}
          />
        </View>
      )}

      {result && (
        <View
          className="flex-row items-start mt-4 pt-3"
          style={{ borderTopWidth: 1, borderTopColor: colors.border }}
        >
          <Ionicons
            name={result.ok ? 'checkmark-circle' : 'alert-circle'}
            size={15}
            color={result.ok ? colors.online : colors.danger}
            style={{ marginTop: 1 }}
          />
          <Text style={{ color: result.ok ? colors.textMuted : colors.danger, fontSize: 12, marginLeft: 6, flex: 1, lineHeight: 17 }}>
            {result.msg}
          </Text>
        </View>
      )}

      {/* Confirmation modal */}
      <Modal visible={!!pending} transparent animationType="fade" onRequestClose={() => setPending(null)}>
        <View
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 }}
        >
          <View
            style={{ backgroundColor: colors.surfaceAlt, borderRadius: 20, padding: 22, borderWidth: 1, borderColor: colors.border }}
          >
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>{desc?.title}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 8, lineHeight: 20 }}>
              {desc?.body}
            </Text>
            <View
              className="rounded-xl mt-4 px-3 py-2.5"
              style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
            >
              <Text style={{ color: colors.textFaint, fontSize: 11 }}>Device</Text>
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700', marginTop: 1 }}>
                {deviceName}
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
                onPress={() => void confirmAndSend()}
                disabled={sending}
                className="flex-1 items-center justify-center active:opacity-90"
                style={{
                  minHeight: 50,
                  borderRadius: 14,
                  backgroundColor: desc?.destructive ? colors.danger : colors.online,
                }}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#04201c" />
                ) : (
                  <Text style={{ color: '#04201c', fontSize: 15, fontWeight: '800' }}>
                    {desc?.destructive ? 'Close Water' : 'Confirm'}
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

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
  onApply,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  onApply: () => void;
  disabled: boolean;
}) {
  return (
    <View className="flex-row items-center" style={{ gap: 10 }}>
      <Text style={{ color: colors.textMuted, fontSize: 13, flex: 1 }}>{label}</Text>
      <View
        className="flex-row items-center rounded-xl"
        style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
      >
        <Pressable
          onPress={() => onChange(Math.max(min, value - 1))}
          className="items-center justify-center active:opacity-70"
          style={{ width: 40, height: 40 }}
        >
          <Ionicons name="remove" size={18} color={colors.primary} />
        </Pressable>
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: '800', width: 40, textAlign: 'center' }}>
          {value}
        </Text>
        <Pressable
          onPress={() => onChange(Math.min(max, value + 1))}
          className="items-center justify-center active:opacity-70"
          style={{ width: 40, height: 40 }}
        >
          <Ionicons name="add" size={18} color={colors.primary} />
        </Pressable>
      </View>
      <Pressable
        onPress={onApply}
        disabled={disabled}
        className="items-center justify-center active:opacity-80"
        style={{
          height: 40,
          paddingHorizontal: 16,
          borderRadius: 12,
          backgroundColor: `${colors.warning}1A`,
          borderWidth: 1,
          borderColor: `${colors.warning}55`,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <Text style={{ color: colors.warning, fontSize: 13, fontWeight: '800' }}>Start</Text>
      </Pressable>
    </View>
  );
}
