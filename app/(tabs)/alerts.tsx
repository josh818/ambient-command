import { useEffect, useMemo, useRef } from 'react';
import { View, Text, ScrollView, Pressable, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/constants/theme';
import { useSensors } from '../../src/lib/sensorStore';
import { useLiveData } from '../../src/lib/useLiveData';
import { useSmartAlerts, alertCategoryMeta, type SmartAlert } from '../../src/lib/alerts';
import { formatRelativeTime } from '../../src/lib/mockData';
import {
  useAlertSession,
  trackAlerts,
  acknowledgeAlert,
  acknowledgeAlerts,
  alertFirstSeen,
} from '../../src/lib/alertSession';
import { hapticTap, hapticSuccess } from '../../src/lib/haptics';
import { notifySuccess } from '../../src/lib/notify';

type Level = 'danger' | 'warning' | 'info';

const levelMeta: Record<
  Level,
  { color: string; bg: string; label: string; icon: string }
> = {
  danger: { color: colors.danger, bg: 'rgba(248,113,113,0.12)', label: 'Critical', icon: 'warning' },
  warning: { color: colors.warning, bg: 'rgba(251,191,36,0.12)', label: 'Warning', icon: 'alert-circle' },
  info: { color: colors.accent, bg: 'rgba(129,140,248,0.12)', label: 'Info', icon: 'information-circle' },
};

function AlertRow({ alert, onAck }: { alert: SmartAlert; onAck: (id: string) => void }) {
  const meta = levelMeta[alert.level];
  const cat = alertCategoryMeta(alert.category);
  const fade = useRef(new Animated.Value(1)).current;

  const handleAck = () => {
    void hapticTap();
    Animated.timing(fade, {
      toValue: 0,
      duration: 220,
      useNativeDriver: false,
    }).start(() => onAck(alert.id));
  };

  return (
    <Animated.View style={{ opacity: fade, marginBottom: 12 }}>
      <View
        className="rounded-2xl p-4"
        style={{
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderLeftWidth: 3,
          borderLeftColor: meta.color,
        }}
      >
        <View className="flex-row items-start">
          <View
            className="w-10 h-10 rounded-xl items-center justify-center mr-3"
            style={{ backgroundColor: meta.bg }}
          >
            <Ionicons name={cat.icon as any} size={20} color={meta.color} />
          </View>
          <View className="flex-1">
            <View className="flex-row items-center">
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700', flex: 1 }} numberOfLines={2}>
                {alert.title}
              </Text>
              <Text style={{ color: colors.textFaint, fontSize: 11, fontWeight: '600', marginLeft: 8 }}>
                {formatRelativeTime(alertFirstSeen(alert.id))}
              </Text>
            </View>
            <Text style={{ color: colors.textFaint, fontSize: 11, marginTop: 2 }}>
              {cat.label} · {alert.location}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 6, lineHeight: 18 }}>
              {alert.message}
            </Text>
          </View>
        </View>

        <View
          className="flex-row items-center mt-3 pt-3"
          style={{ borderTopWidth: 1, borderTopColor: colors.border }}
        >
          <Ionicons name="bulb-outline" size={14} color={colors.primary} />
          <Text style={{ color: colors.textMuted, fontSize: 12, marginLeft: 6, flex: 1, lineHeight: 17 }}>
            {alert.recommendation}
          </Text>
          <Pressable
            onPress={handleAck}
            className="flex-row items-center px-3 py-1.5 rounded-full active:opacity-70"
            style={{
              backgroundColor: colors.surfaceAlt,
              borderWidth: 1,
              borderColor: colors.border,
              marginLeft: 12,
            }}
            accessibilityRole="button"
            accessibilityLabel={`Acknowledge alert: ${alert.title}`}
          >
            <Ionicons name="checkmark" size={13} color={colors.primary} />
            <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700', marginLeft: 4 }}>
              Ack
            </Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

function SeveritySection({
  level,
  alerts,
  onAck,
}: {
  level: Level;
  alerts: SmartAlert[];
  onAck: (id: string) => void;
}) {
  if (alerts.length === 0) return null;
  const meta = levelMeta[level];
  return (
    <View style={{ marginTop: 24 }}>
      <View className="flex-row items-center" style={{ marginBottom: 12 }}>
        <Ionicons name={meta.icon as any} size={15} color={meta.color} />
        <Text
          style={{
            color: meta.color,
            fontSize: 13,
            fontWeight: '800',
            letterSpacing: 0.8,
            marginLeft: 7,
          }}
        >
          {meta.label.toUpperCase()}
        </Text>
        <View
          className="ml-2 px-2 py-0.5 rounded-full"
          style={{ backgroundColor: meta.bg }}
        >
          <Text style={{ color: meta.color, fontSize: 11, fontWeight: '800' }}>
            {alerts.length}
          </Text>
        </View>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border, marginLeft: 12 }} />
      </View>
      {alerts.map((a) => (
        <AlertRow key={a.id} alert={a} onAck={onAck} />
      ))}
    </View>
  );
}

export default function AlertsScreen() {
  const { sensors: stored } = useSensors();
  const { liveSensors: sensors } = useLiveData(stored);
  const { alerts, counts } = useSmartAlerts(sensors);
  const session = useAlertSession();

  // Stamp first-seen times + last-checked whenever alerts re-evaluate.
  useEffect(() => {
    trackAlerts(alerts);
  }, [alerts]);

  const active = useMemo(
    () => alerts.filter((a) => !session.acknowledged.has(a.id)),
    [alerts, session.acknowledged],
  );
  const critical = active.filter((a) => a.level === 'danger');
  const warnings = active.filter((a) => a.level === 'warning');
  const info = active.filter((a) => a.level === 'info');
  const ackedCount = alerts.length - active.length;

  const handleAck = (id: string) => {
    acknowledgeAlert(id);
  };

  const handleAckAll = () => {
    void hapticSuccess();
    acknowledgeAlerts(active.map((a) => a.id));
    notifySuccess(
      'All alerts acknowledged',
      `${active.length} alert${active.length === 1 ? '' : 's'} cleared for this session`,
    );
  };

  const lastChecked = new Date(session.lastCheckedAt).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
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
            backgroundColor: critical.length > 0 ? 'rgba(248,113,113,0.10)' : colors.surface,
            borderWidth: 1,
            borderColor: critical.length > 0 ? colors.danger + '40' : colors.border,
          }}
        >
          <View
            className="w-11 h-11 rounded-xl items-center justify-center mr-3"
            style={{
              backgroundColor:
                critical.length > 0
                  ? 'rgba(248,113,113,0.18)'
                  : active.length > 0
                    ? 'rgba(251,191,36,0.18)'
                    : 'rgba(52,211,153,0.18)',
            }}
          >
            <Ionicons
              name={
                critical.length > 0
                  ? 'warning'
                  : active.length > 0
                    ? 'alert-circle'
                    : 'shield-checkmark'
              }
              size={22}
              color={
                critical.length > 0
                  ? colors.danger
                  : active.length > 0
                    ? colors.warning
                    : colors.online
              }
            />
          </View>
          <View className="flex-1">
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
              {critical.length > 0
                ? `${critical.length} critical ${critical.length === 1 ? 'event' : 'events'}`
                : active.length > 0
                  ? `${active.length} active ${active.length === 1 ? 'alert' : 'alerts'}`
                  : 'All systems normal'}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>
              {critical.length > 0
                ? 'Immediate attention required'
                : active.length > 0
                  ? 'Review the items below'
                  : 'No threats detected across your sensors'}
            </Text>
          </View>
        </View>

        {/* Acknowledge all */}
        {active.length > 0 && (
          <Pressable
            onPress={handleAckAll}
            className="rounded-2xl py-3.5 items-center flex-row justify-center active:opacity-80"
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.primary + '55',
              marginTop: 14,
            }}
            accessibilityRole="button"
          >
            <Ionicons name="checkmark-done" size={17} color={colors.primary} />
            <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '700', marginLeft: 8 }}>
              Acknowledge all ({active.length})
            </Text>
          </Pressable>
        )}

        {/* Severity-grouped sections */}
        {active.length > 0 ? (
          <>
            <SeveritySection level="danger" alerts={critical} onAck={handleAck} />
            <SeveritySection level="warning" alerts={warnings} onAck={handleAck} />
            <SeveritySection level="info" alerts={info} onAck={handleAck} />
          </>
        ) : (
          /* Designed empty state */
          <View
            className="rounded-2xl items-center justify-center"
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              marginTop: 24,
              paddingVertical: 48,
              paddingHorizontal: 24,
            }}
          >
            <View
              className="items-center justify-center"
              style={{
                width: 88,
                height: 88,
                borderRadius: 44,
                backgroundColor: 'rgba(52,211,153,0.10)',
                borderWidth: 1,
                borderColor: 'rgba(52,211,153,0.35)',
              }}
            >
              <Ionicons name="shield-checkmark" size={44} color={colors.online} />
            </View>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 18 }}>
              All clear — no active alerts
            </Text>
            <Text
              style={{
                color: colors.textMuted,
                fontSize: 13,
                marginTop: 8,
                textAlign: 'center',
                lineHeight: 19,
              }}
            >
              {counts.total > 0
                ? 'Every alert has been acknowledged for this session.'
                : 'Your sensor fleet is quiet. New alerts will appear here the moment anything changes.'}
            </Text>
            <View className="flex-row items-center" style={{ marginTop: 16 }}>
              <Ionicons name="time-outline" size={13} color={colors.textFaint} />
              <Text style={{ color: colors.textFaint, fontSize: 12, marginLeft: 5 }}>
                Last checked {lastChecked}
              </Text>
            </View>
          </View>
        )}

        {/* Session footer */}
        {ackedCount > 0 && active.length > 0 && (
          <Text
            style={{
              color: colors.textFaint,
              fontSize: 12,
              textAlign: 'center',
              marginTop: 16,
            }}
          >
            {ackedCount} alert{ackedCount === 1 ? '' : 's'} acknowledged this session ·
            last checked {lastChecked}
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
