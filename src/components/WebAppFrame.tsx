import { Platform, View } from 'react-native';
import { colors } from '../constants/theme';

/** Keep the mobile interface readable on desktop without changing native layout. */
export function WebAppFrame({ children }: { children: React.ReactNode }) {
  if (Platform.OS !== 'web') return <>{children}</>;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{
        flex: 1, width: '100%', maxWidth: 600, alignSelf: 'center',
        borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.border,
      }}>
        {children}
      </View>
    </View>
  );
}
