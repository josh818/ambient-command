import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/theme';
import { useConnectivity } from '../lib/useConnectivity';

const statusMap = {
  idle: { label: 'Connecting…', color: colors.textMuted, icon: 'ellipse-outline' },
  checking: { label: 'Checking…', color: colors.warning, icon: 'sync' },
  online: { label: 'Connected', color: colors.online, icon: 'cloud-done' },
  offline: { label: 'Offline', color: colors.danger, icon: 'cloud-offline' },
} as const;

export function ApiStatusBanner() {
  const { status, rawDataCount, error, refresh } = useConnectivity();
  const meta = statusMap[status];

  return (
    <Pressable
      onPress={() => void refresh()}
      className="rounded-2xl p-4 active:opacity-80"
      style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
    >
      <View className="flex-row items-center">
        <View
          className="w-9 h-9 rounded-xl items-center justify-center mr-3"
          style={{ backgroundColor: meta.color + '22' }}
        >
          {status === 'checking' ? (
            <ActivityIndicator size="small" color={meta.color} />
          ) : (
            <Ionicons name={meta.icon as any} size={18} color={meta.color} />
          )}
        </View>
        <View className="flex-1">
          <View className="flex-row items-center">
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>
              API · {meta.label}
            </Text>
          </View>
          <Text style={{ color: colors.textFaint, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
            {status === 'online'
              ? `${rawDataCount?.toLocaleString() ?? 0} records in database`
              : status === 'offline'
                ? error ?? 'Tap to retry'
                : 'asvupdateserver.ddns.net:2001'}
          </Text>
        </View>
        <Ionicons name="refresh" size={16} color={colors.textFaint} />
      </View>
    </Pressable>
  );
}
