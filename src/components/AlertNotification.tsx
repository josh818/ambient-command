import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/theme';
import { alertCategoryMeta, type SmartAlert } from '../lib/alerts';

export type AlertLevel = 'danger' | 'warning' | 'info';

export interface AppAlert {
  id: string;
  level: AlertLevel;
  title: string;
  message: string;
  time: string;
}

const levelMeta: Record<
  AlertLevel,
  { color: string; bg: string }
> = {
  danger: { color: colors.danger, bg: 'rgba(224,114,89,0.12)' },
  warning: { color: colors.warning, bg: 'rgba(254,190,100,0.12)' },
  info: { color: colors.accent, bg: 'rgba(129,140,248,0.12)' },
};

// Compact legacy card (kept for backwards compatibility on the dashboard).
export function AlertNotification({ alert }: { alert: AppAlert }) {
  const meta = levelMeta[alert.level];
  const icon =
    alert.level === 'danger'
      ? 'warning'
      : alert.level === 'warning'
        ? 'alert-circle'
        : 'information-circle';
  return (
    <View
      className="flex-row items-start rounded-2xl p-3.5 mb-2.5"
      style={{ backgroundColor: meta.bg, borderWidth: 1, borderColor: meta.color + '33' }}
    >
      <View
        className="w-9 h-9 rounded-full items-center justify-center mr-3"
        style={{ backgroundColor: meta.color + '22' }}
      >
        <Ionicons name={icon as any} size={18} color={meta.color} />
      </View>
      <View className="flex-1">
        <View className="flex-row items-center justify-between">
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>
            {alert.title}
          </Text>
          <Text style={{ color: colors.textFaint, fontSize: 11 }}>{alert.time}</Text>
        </View>
        <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2, lineHeight: 18 }}>
          {alert.message}
        </Text>
      </View>
    </View>
  );
}

// Rich smart-alert card with priority badge, category and recommendation.
export function SmartAlertCard({
  alert,
  onPress,
}: {
  alert: SmartAlert;
  onPress?: () => void;
}) {
  const meta = levelMeta[alert.level];
  const cat = alertCategoryMeta(alert.category);
  return (
    <View
      className="rounded-2xl p-4 mb-3"
      style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: meta.color + '40' }}
    >
      <View className="flex-row items-start">
        <View
          className="w-10 h-10 rounded-xl items-center justify-center mr-3"
          style={{ backgroundColor: meta.bg }}
        >
          <Ionicons name={cat.icon as any} size={20} color={meta.color} />
        </View>
        <View className="flex-1">
          <View className="flex-row items-center justify-between">
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700', flex: 1 }}>
              {alert.title}
            </Text>
            <View
              className="px-2 py-0.5 rounded-full ml-2"
              style={{ backgroundColor: meta.bg }}
            >
              <Text style={{ color: meta.color, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }}>
                {alert.level === 'danger' ? 'CRITICAL' : alert.level === 'warning' ? 'WARNING' : 'INFO'}
              </Text>
            </View>
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
      </View>
    </View>
  );
}
