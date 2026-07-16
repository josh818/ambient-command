import { View, Text } from 'react-native';
import { statusMeta, type SensorStatus } from '../constants/theme';

export function StatusPill({ status }: { status: SensorStatus }) {
  const meta = statusMeta[status];
  return (
    <View
      className="flex-row items-center px-2.5 py-1 rounded-full"
      style={{ backgroundColor: meta.bg }}
    >
      <View
        className="w-1.5 h-1.5 rounded-full mr-1.5"
        style={{ backgroundColor: meta.color }}
      />
      <Text style={{ color: meta.color, fontSize: 12, fontWeight: '700' }}>
        {meta.label}
      </Text>
    </View>
  );
}
