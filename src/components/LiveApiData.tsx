import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/theme';
import { useConnectivity } from '../lib/useConnectivity';
import { formatRelativeTime } from '../lib/mockData';

// Shows ONLY the data points that are genuinely live on the BH Sensors API.
// The server currently exposes two endpoints — a Sum health check and
// GetRawDataCount — so those are the only real values we can display.
// Device-level leak readings are not yet exposed by the backend.
export function LiveApiData() {
  const { status, rawDataCount, error, checkedAt, refresh } = useConnectivity();
  const isOnline = status === 'online';
  const isChecking = status === 'checking' || status === 'idle';

  return (
    <View
      className="rounded-2xl p-4"
      style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
    >
      <View className="flex-row items-center mb-3">
        <Ionicons name="pulse" size={16} color={colors.primary} />
        <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700', marginLeft: 8 }}>
          Live API Data
        </Text>
        <Pressable className="ml-auto flex-row items-center active:opacity-70" onPress={() => void refresh()}>
          {isChecking ? (
            <ActivityIndicator size="small" color={colors.textFaint} />
          ) : (
            <Ionicons name="refresh" size={15} color={colors.textFaint} />
          )}
        </Pressable>
      </View>

      <View className="flex-row gap-3">
        <View className="flex-1 rounded-xl p-3" style={{ backgroundColor: colors.bg }}>
          <Text style={{ color: colors.textFaint, fontSize: 11 }}>Records in database</Text>
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', marginTop: 2 }}>
            {isOnline ? (rawDataCount?.toLocaleString() ?? '0') : '—'}
          </Text>
        </View>
        <View className="flex-1 rounded-xl p-3" style={{ backgroundColor: colors.bg }}>
          <Text style={{ color: colors.textFaint, fontSize: 11 }}>Service health</Text>
          <Text
            style={{
              color: isOnline ? colors.online : colors.danger,
              fontSize: 22,
              fontWeight: '800',
              marginTop: 2,
            }}
          >
            {isOnline ? 'OK' : isChecking ? '…' : 'Down'}
          </Text>
        </View>
      </View>

      <Text style={{ color: colors.textFaint, fontSize: 11, marginTop: 10, lineHeight: 16 }}>
        {isOnline
          ? `Last updated ${checkedAt ? formatRelativeTime(checkedAt) : 'just now'} · Sum check passed`
          : error ?? 'Reaching asvupdateserver.ddns.net:2001…'}
      </Text>
      <Text style={{ color: colors.textFaint, fontSize: 11, marginTop: 6, lineHeight: 16, fontStyle: 'italic' }}>
        Per-device leak readings are not exposed by the API yet — devices below show demo data until a read endpoint is available.
      </Text>
    </View>
  );
}
