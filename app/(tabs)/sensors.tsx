import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/constants/theme';
import { useSensors } from '../../src/lib/sensorStore';
import { useLiveData } from '../../src/lib/useLiveData';
import { SensorCard } from '../../src/components/SensorCard';
import { NoDevicesAssigned } from '../../src/components/NoDevicesAssigned';
import type { SensorStatus } from '../../src/constants/theme';
import {
  getModuleFromEmail,
  getModuleFromMobileNumber,
  type ModuleRecord,
} from '../../src/lib/api';

type Filter = 'all' | SensorStatus;

const filters: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'online', label: 'Online' },
  { key: 'warning', label: 'Warning' },
  { key: 'offline', label: 'Offline' },
];

type LookupMode = 'email' | 'mobile';

type LookupState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'done'; records: ModuleRecord[] };

// Pull a human-readable field off a server record, trying several likely keys.
function pick(rec: ModuleRecord, keys: string[]): string | null {
  for (const k of keys) {
    const v = rec[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      return String(v);
    }
  }
  return null;
}

function LookupResultCard({ rec }: { rec: ModuleRecord }) {
  const moduleId = pick(rec, ['module_id', 'ModuleID', 'moduleId']);
  const unitName = pick(rec, ['unit_name', 'UnitName', 'unitName']);
  const locationName = pick(rec, ['location_name', 'LocationName', 'locationName']);
  const email = pick(rec, ['email_str', 'email', 'Email']);
  const mobile = pick(rec, ['mobile_str', 'mobile', 'Mobile', 'cell']);

  return (
    <View
      className="rounded-xl p-4 mb-2"
      style={{ backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border }}
    >
      <View className="flex-row items-center mb-1">
        <Ionicons name="hardware-chip-outline" size={16} color={colors.primary} />
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700', marginLeft: 7 }}>
          {unitName ?? 'Unnamed module'}
        </Text>
      </View>
      {locationName && (
        <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 2 }}>
          {locationName}
        </Text>
      )}
      {moduleId && (
        <Text style={{ color: colors.textFaint, fontSize: 11, fontFamily: 'monospace' }}>
          ID {moduleId}
        </Text>
      )}
      {(email || mobile) && (
        <View className="flex-row flex-wrap mt-2" style={{ gap: 6 }}>
          {email && (
            <View
              className="flex-row items-center px-2 py-1 rounded-md"
              style={{ backgroundColor: colors.surface }}
            >
              <Ionicons name="mail-outline" size={11} color={colors.textFaint} />
              <Text style={{ color: colors.textMuted, fontSize: 11, marginLeft: 4 }}>{email}</Text>
            </View>
          )}
          {mobile && (
            <View
              className="flex-row items-center px-2 py-1 rounded-md"
              style={{ backgroundColor: colors.surface }}
            >
              <Ionicons name="call-outline" size={11} color={colors.textFaint} />
              <Text style={{ color: colors.textMuted, fontSize: 11, marginLeft: 4 }}>{mobile}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

export default function SensorsScreen() {
  const { sensors: stored, noDevicesAssigned, access } = useSensors();
  const { liveSensors: sensors } = useLiveData(stored);
  const params = useLocalSearchParams<{ filter?: string }>();
  const [filter, setFilter] = useState<Filter>('all');

  // Allow deep-links like /(tabs)/sensors?filter=warning (used by the
  // dashboard health ring to jump straight to problem sensors).
  useEffect(() => {
    const requested = params.filter;
    if (requested && filters.some((f) => f.key === requested)) {
      setFilter(requested as Filter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.filter]);

  const [lookupMode, setLookupMode] = useState<LookupMode>('email');
  const [query, setQuery] = useState('');
  const [lookup, setLookup] = useState<LookupState>({ phase: 'idle' });

  const list = useMemo(
    () => (filter === 'all' ? sensors : sensors.filter((s) => s.status === filter)),
    [sensors, filter],
  );

  const runLookup = async () => {
    const term = query.trim();
    if (!term) return;
    setLookup({ phase: 'loading' });
    try {
      const records =
        lookupMode === 'email'
          ? await getModuleFromEmail(term)
          : await getModuleFromMobileNumber(term);
      setLookup({ phase: 'done', records });
    } catch (e) {
      setLookup({
        phase: 'error',
        message: e instanceof Error ? e.message : 'Request failed',
      });
    }
  };

  // Account has no devices assigned — show the designed empty state instead
  // of the roster (and instead of the server lookup tools).
  if (noDevicesAssigned) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: colors.bg }} edges={['top']}>
        <View className="px-5 pt-2 pb-1">
          <Text style={{ color: colors.text, fontSize: 26, fontWeight: '800' }}>Sensors</Text>
          <Text style={{ color: colors.textFaint, fontSize: 13, marginTop: 2 }}>
            0 devices assigned
          </Text>
        </View>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, paddingTop: 16 }}
          showsVerticalScrollIndicator={false}
        >
          <NoDevicesAssigned email={access.userEmail} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.bg }} edges={['top']}>
      <View className="px-5 pt-2 pb-1">
        <Text style={{ color: colors.text, fontSize: 26, fontWeight: '800' }}>Sensors</Text>
        <Text style={{ color: colors.textFaint, fontSize: 13, marginTop: 2 }}>
          {sensors.length} devices · tap to control & rename
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, paddingTop: 6 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Live server lookup */}
        <View
          className="rounded-2xl p-4 mb-4"
          style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
        >
          <View className="flex-row items-center mb-3">
            <Ionicons name="search" size={16} color={colors.primary} />
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700', marginLeft: 7 }}>
              Find modules on server
            </Text>
          </View>

          {/* Mode toggle */}
          <View
            className="flex-row p-1 rounded-xl mb-3"
            style={{ backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border }}
          >
            {(['email', 'mobile'] as LookupMode[]).map((m) => {
              const active = m === lookupMode;
              return (
                <Pressable
                  key={m}
                  onPress={() => {
                    setLookupMode(m);
                    setLookup({ phase: 'idle' });
                    setQuery('');
                  }}
                  className="flex-1 py-2 rounded-lg items-center active:opacity-80"
                  style={{ backgroundColor: active ? colors.primary : 'transparent' }}
                >
                  <Text
                    style={{
                      color: active ? colors.bg : colors.textMuted,
                      fontSize: 13,
                      fontWeight: '700',
                    }}
                  >
                    {m === 'email' ? 'By Email' : 'By Mobile'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Input + submit */}
          <View className="flex-row" style={{ gap: 8 }}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={runLookup}
              placeholder={lookupMode === 'email' ? 'name@example.com' : '9083343535'}
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType={lookupMode === 'email' ? 'email-address' : 'phone-pad'}
              className="flex-1 px-3 py-2.5 rounded-xl"
              style={{
                backgroundColor: colors.surfaceAlt,
                borderWidth: 1,
                borderColor: colors.border,
                color: colors.text,
                fontSize: 14,
              }}
            />
            <Pressable
              onPress={runLookup}
              disabled={lookup.phase === 'loading' || !query.trim()}
              className="px-4 rounded-xl items-center justify-center active:opacity-80"
              style={{
                backgroundColor: query.trim() ? colors.primary : colors.surfaceAlt,
                borderWidth: 1,
                borderColor: query.trim() ? colors.primary : colors.border,
              }}
            >
              {lookup.phase === 'loading' ? (
                <ActivityIndicator size="small" color={colors.bg} />
              ) : (
                <Ionicons
                  name="arrow-forward"
                  size={18}
                  color={query.trim() ? colors.bg : colors.textFaint}
                />
              )}
            </Pressable>
          </View>

          {/* Results */}
          {lookup.phase === 'error' && (
            <View
              className="flex-row items-center rounded-xl p-3 mt-3"
              style={{ backgroundColor: 'rgba(224,114,89,0.10)', borderWidth: 1, borderColor: colors.danger + '55' }}
            >
              <Ionicons name="cloud-offline" size={15} color={colors.danger} />
              <Text style={{ color: colors.textMuted, fontSize: 12, marginLeft: 8, flex: 1, lineHeight: 17 }}>
                Server unreachable ({lookup.message}). No data shown.
              </Text>
            </View>
          )}

          {lookup.phase === 'done' && lookup.records.length === 0 && (
            <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 12 }}>
              No modules found for that {lookupMode === 'email' ? 'email' : 'number'}.
            </Text>
          )}

          {lookup.phase === 'done' && lookup.records.length > 0 && (
            <View className="mt-3">
              <Text style={{ color: colors.textFaint, fontSize: 12, marginBottom: 8 }}>
                {lookup.records.length} module(s) returned (live)
              </Text>
              {lookup.records.map((rec, i) => (
                <LookupResultCard key={i} rec={rec} />
              ))}
            </View>
          )}
        </View>

        {/* Status filters */}
        <View className="flex-row mb-4" style={{ gap: 8 }}>
          {filters.map((f) => {
            const active = f.key === filter;
            return (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                className="px-4 py-2 rounded-full"
                style={{
                  backgroundColor: active ? colors.primary : colors.surface,
                  borderWidth: 1,
                  borderColor: active ? colors.primary : colors.border,
                }}
              >
                <Text
                  style={{
                    color: active ? colors.bg : colors.textMuted,
                    fontSize: 13,
                    fontWeight: '700',
                  }}
                >
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {list.length === 0 ? (
          <View className="items-center justify-center py-16">
            <Text style={{ color: colors.textFaint, fontSize: 14 }}>No sensors in this view</Text>
          </View>
        ) : (
          list.map((s) => <SensorCard key={s.id} sensor={s} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
