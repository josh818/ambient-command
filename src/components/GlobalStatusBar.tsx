import { useMemo } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/theme';
import { useConnectivity } from '../lib/useConnectivity';
import { useSensors } from '../lib/sensorStore';

// A compact, always-visible system health bar rendered at the top of every
// primary tab. It aggregates three live signals into a single "overall"
// indicator: API/database connectivity, sensor mesh health, and active
// alerts (warning/offline sensors). Tapping the API segment retries the
// connectivity check.

type Health = 'healthy' | 'degraded' | 'critical' | 'checking';

const healthMeta: Record<Health, { label: string; color: string; icon: string }> = {
  healthy: { label: 'All Systems Operational', color: colors.online, icon: 'shield-checkmark' },
  degraded: { label: 'Degraded Performance', color: colors.warning, icon: 'warning' },
  critical: { label: 'Attention Required', color: colors.danger, icon: 'alert-circle' },
  checking: { label: 'Checking Systems…', color: colors.textMuted, icon: 'sync' },
};

function Segment({
  icon,
  value,
  tint,
  spinning,
}: {
  icon: string;
  value: string;
  tint: string;
  spinning?: boolean;
}) {
  return (
    <View className="flex-row items-center">
      {spinning ? (
        <ActivityIndicator size="small" color={tint} />
      ) : (
        <Ionicons name={icon as any} size={13} color={tint} />
      )}
      <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600', marginLeft: 4 }}>
        {value}
      </Text>
    </View>
  );
}

export function GlobalStatusBar() {
  const { status, refresh } = useConnectivity();
  const { sensors } = useSensors();

  const counts = useMemo(() => {
    const online = sensors.filter((s) => s.status === 'online').length;
    const warning = sensors.filter((s) => s.status === 'warning').length;
    const offline = sensors.filter((s) => s.status === 'offline').length;
    return { online, warning, offline, total: sensors.length };
  }, [sensors]);

  const health: Health = useMemo(() => {
    if (status === 'checking' || status === 'idle') return 'checking';
    if (status === 'offline' || counts.offline > 0) return 'critical';
    if (counts.warning > 0) return 'degraded';
    return 'healthy';
  }, [status, counts]);

  const meta = healthMeta[health];
  const apiOnline = status === 'online';

  return (
    <View
      className="flex-row items-center px-4 py-2.5"
      style={{
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      {/* Overall health pulse */}
      <View
        className="w-7 h-7 rounded-full items-center justify-center mr-2.5"
        style={{ backgroundColor: meta.color + '22' }}
      >
        {health === 'checking' ? (
          <ActivityIndicator size="small" color={meta.color} />
        ) : (
          <Ionicons name={meta.icon as any} size={15} color={meta.color} />
        )}
      </View>

      <View className="flex-1 mr-2">
        <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }} numberOfLines={1}>
          {meta.label}
        </Text>
        <View className="flex-row items-center mt-0.5" style={{ gap: 12 }}>
          <Segment icon="ellipse" value={`${counts.online} online`} tint={colors.online} />
          {counts.warning > 0 && (
            <Segment icon="ellipse" value={`${counts.warning} warn`} tint={colors.warning} />
          )}
          {counts.offline > 0 && (
            <Segment icon="ellipse" value={`${counts.offline} offline`} tint={colors.offline} />
          )}
        </View>
      </View>

      {/* API connectivity chip (tap to retry) */}
      <Pressable
        onPress={() => void refresh()}
        className="flex-row items-center rounded-full px-2.5 py-1 active:opacity-70"
        style={{ backgroundColor: colors.surfaceAlt }}
      >
        <Segment
          icon={apiOnline ? 'cloud-done' : 'cloud-offline'}
          value="API"
          tint={apiOnline ? colors.online : status === 'offline' ? colors.danger : colors.warning}
          spinning={status === 'checking'}
        />
      </Pressable>
    </View>
  );
}
