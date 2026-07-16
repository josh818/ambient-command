import { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/constants/theme';
import { useSensors } from '../../src/lib/sensorStore';
import { useLiveData } from '../../src/lib/useLiveData';
import { useSmartAlerts, type SmartAlert } from '../../src/lib/alerts';
import { SmartAlertCard } from '../../src/components/AlertNotification';

type Filter = 'all' | 'critical' | 'warning' | 'info';

export default function AlertsScreen() {
  const { sensors: stored } = useSensors();
  const { liveSensors: sensors } = useLiveData(stored);
  const { alerts, counts } = useSmartAlerts(sensors);
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = useMemo<SmartAlert[]>(() => {
    if (filter === 'all') return alerts;
    const level = filter === 'critical' ? 'danger' : filter;
    return alerts.filter((a) => a.level === level);
  }, [alerts, filter]);

  const chips: { key: Filter; label: string; count: number; color: string }[] = [
    { key: 'all', label: 'All', count: counts.total, color: colors.primary },
    { key: 'critical', label: 'Critical', count: counts.critical, color: colors.danger },
    { key: 'warning', label: 'Warnings', count: counts.warnings, color: colors.warning },
    { key: 'info', label: 'Info', count: counts.info, color: colors.accent },
  ];

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-1">
          <Text style={{ color: colors.textFaint, fontSize: 13 }}>Monitoring</Text>
          <Text style={{ color: colors.text, fontSize: 26, fontWeight: '800' }}>Smart Alerts</Text>
        </View>

        {/* Summary banner */}
        <View
          className="rounded-2xl p-4 mt-4 flex-row items-center"
          style={{
            backgroundColor: counts.critical > 0 ? 'rgba(248,113,113,0.10)' : colors.surface,
            borderWidth: 1,
            borderColor: counts.critical > 0 ? colors.danger + '40' : colors.border,
          }}
        >
          <View
            className="w-11 h-11 rounded-xl items-center justify-center mr-3"
            style={{
              backgroundColor:
                counts.critical > 0
                  ? 'rgba(248,113,113,0.18)'
                  : counts.total > 0
                    ? 'rgba(251,191,36,0.18)'
                    : 'rgba(52,211,153,0.18)',
            }}
          >
            <Ionicons
              name={
                counts.critical > 0
                  ? 'warning'
                  : counts.total > 0
                    ? 'alert-circle'
                    : 'shield-checkmark'
              }
              size={22}
              color={
                counts.critical > 0
                  ? colors.danger
                  : counts.total > 0
                    ? colors.warning
                    : colors.online
              }
            />
          </View>
          <View className="flex-1">
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
              {counts.critical > 0
                ? `${counts.critical} critical ${counts.critical === 1 ? 'event' : 'events'}`
                : counts.total > 0
                  ? `${counts.total} active ${counts.total === 1 ? 'alert' : 'alerts'}`
                  : 'All systems normal'}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>
              {counts.critical > 0
                ? 'Immediate attention required'
                : counts.total > 0
                  ? 'Review the items below'
                  : 'No threats detected across your sensors'}
            </Text>
          </View>
        </View>

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mt-4"
          contentContainerStyle={{ gap: 8 }}
        >
          {chips.map((c) => {
            const active = filter === c.key;
            return (
              <Pressable
                key={c.key}
                onPress={() => setFilter(c.key)}
                className="flex-row items-center px-3.5 py-2 rounded-full"
                style={{
                  backgroundColor: active ? c.color + '22' : colors.surface,
                  borderWidth: 1,
                  borderColor: active ? c.color + '66' : colors.border,
                }}
              >
                <Text
                  style={{
                    color: active ? c.color : colors.textMuted,
                    fontSize: 13,
                    fontWeight: '700',
                  }}
                >
                  {c.label}
                </Text>
                <View
                  className="ml-1.5 px-1.5 rounded-full"
                  style={{ backgroundColor: active ? c.color + '33' : colors.surfaceAlt }}
                >
                  <Text
                    style={{
                      color: active ? c.color : colors.textFaint,
                      fontSize: 11,
                      fontWeight: '800',
                    }}
                  >
                    {c.count}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Alert list */}
        <View className="mt-5">
          {filtered.length === 0 ? (
            <View
              className="rounded-2xl items-center justify-center py-12"
              style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
            >
              <View
                className="w-14 h-14 rounded-full items-center justify-center mb-3"
                style={{ backgroundColor: 'rgba(52,211,153,0.15)' }}
              >
                <Ionicons name="checkmark-done" size={28} color={colors.online} />
              </View>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
                Nothing to report
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>
                No {filter === 'all' ? '' : filter + ' '}alerts right now.
              </Text>
            </View>
          ) : (
            filtered.map((a) => <SmartAlertCard key={a.id} alert={a} />)
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
