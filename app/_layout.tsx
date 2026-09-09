import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text as RNText, TextInput as RNTextInput } from 'react-native';
// SafeAreaProvider import redirected to the Shipper preview shim below.
import { ConvexReactClient } from 'convex/react';
import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react';
import { authClient } from '../lib/auth-client';
import { ToastHost } from '../src/components/ToastHost';
import '../global.css';
import { PreviewStatusBar } from "@/components/PreviewStatusBar";
import { SafeAreaProvider } from "@/components/PreviewSafeAreaProvider"; // Shipper preview shim — real insets on web, pass-through on device
import { WebAppFrame } from "../src/components/WebAppFrame";

// Default every <Text>/<TextInput> to the brand sans (Space Grotesk). On web
// the single family carries all weights via the Google Fonts <link>, so each
// component's own inline fontWeight/fontSize still wins. No render gating.
(RNText as any).defaultProps = {
  ...((RNText as any).defaultProps ?? {}),
  style: { fontFamily: 'Space Grotesk' },
};
(RNTextInput as any).defaultProps = {
  ...((RNTextInput as any).defaultProps ?? {}),
  style: { fontFamily: 'Space Grotesk' },
};

// Fall back to the known production deployment address so a preview or web
// export that is missing EXPO_PUBLIC_CONVEX_URL doesn't construct the client
// with `undefined` and crash to a blank screen on startup.
const CONVEX_URL =
  process.env.EXPO_PUBLIC_CONVEX_URL || 'https://formal-guanaco-79.convex.cloud';

const convex = new ConvexReactClient(CONVEX_URL, {
  unsavedChangesWarning: false,
});

export default function RootLayout() {
  return (
    <ConvexBetterAuthProvider client={convex} authClient={authClient}>
      <SafeAreaProvider
        initialMetrics={{
          insets: { top: 72, bottom: 34, left: 0, right: 0 },
          frame: { x: 0, y: 0, width: 393, height: 852 },
        }}
      >
        <StatusBar style="light" />
        <ToastHost />
        <WebAppFrame>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="auth" options={{ presentation: 'card' }} />
            <Stack.Screen
              name="sensor/[id]"
              options={{
                presentation: 'card',
                animation: 'slide_from_right',
              }}
            />
            <Stack.Screen
              name="scenes/create"
              options={{
                presentation: 'modal',
                animation: 'slide_from_bottom',
              }}
            />
          </Stack>
        </WebAppFrame>
        <PreviewStatusBar />
    </SafeAreaProvider>
    </ConvexBetterAuthProvider>
  );
}
