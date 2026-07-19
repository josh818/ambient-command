import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/theme';

// Shown on the dashboard and sensors screens when the signed-in account has
// zero devices assigned (see src/lib/deviceAccess.ts). Displays the signed-in
// email so an administrator knows exactly which address to assign modules to.
export function NoDevicesAssigned({ email }: { email: string | null }) {
  return (
    <View
      className="rounded-2xl items-center"
      style={{
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 20,
        paddingVertical: 40,
        gap: 16,
      }}
    >
      <View
        className="items-center justify-center rounded-full"
        style={{ width: 72, height: 72, backgroundColor: colors.surfaceAlt }}
      >
        <Ionicons name="hardware-chip-outline" size={34} color={colors.textFaint} />
      </View>

      <View className="items-center" style={{ gap: 6 }}>
        <Text
          style={{ color: colors.text, fontSize: 17, fontWeight: '700', textAlign: 'center' }}
        >
          No devices assigned to your account
        </Text>
        <Text
          style={{
            color: colors.textMuted,
            fontSize: 14,
            lineHeight: 20,
            textAlign: 'center',
            maxWidth: 280,
          }}
        >
          Ask your administrator to assign your sensors
        </Text>
      </View>

      {email && (
        <View
          className="flex-row items-center rounded-full"
          style={{
            backgroundColor: colors.surfaceAlt,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: 14,
            paddingVertical: 8,
          }}
        >
          <Ionicons name="mail-outline" size={14} color={colors.primary} />
          <Text style={{ color: colors.textMuted, fontSize: 13, marginLeft: 8 }}>{email}</Text>
        </View>
      )}
    </View>
  );
}
