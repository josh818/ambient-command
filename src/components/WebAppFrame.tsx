import { Platform, View } from 'react-native';

/**
 * Centers the app inside a fixed-width "phone" column on wide web viewports.
 *
 * The whole UI is laid out for a ~390px mobile width. Without this, the
 * production web build stretches every screen edge-to-edge across a desktop
 * browser window — inputs, buttons and cards all balloon to 1500px+ wide
 * while the vertical rhythm (built for mobile) stays the same, so everything
 * reads as cramped/misaligned. This wraps the whole app in a max-width
 * column so spacing looks intentional at any browser width. Native
 * (iOS/Android) is unaffected — it renders full-bleed as normal.
 */
export function WebAppFrame({ children }: { children: React.ReactNode }) {
  if (Platform.OS !== 'web') {
    return <>{children}</>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0B0B2E' }}>
      <View
        style={{
          flex: 1,
          width: '100%',
          maxWidth: 480,
          alignSelf: 'center',
          shadowColor: '#000',
          shadowOpacity: 0.4,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 0 },
        }}
      >
        {children}
      </View>
    </View>
  );
}
