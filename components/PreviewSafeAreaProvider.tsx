import { Platform } from "react-native";
import type { ComponentProps } from "react";
import {
  SafeAreaProvider as RNSafeAreaProvider,
  SafeAreaInsetsContext,
  SafeAreaFrameContext,
} from "react-native-safe-area-context";

// iPhone-15-class frame. The top inset is deliberately larger than the real
// device's 59: the status bar chrome stays 59 tall, and the extra 13px is
// breathing room between the chrome and the app's content in the preview.
const PREVIEW_INSETS = { top: 72, bottom: 34, left: 0, right: 0 };
const PREVIEW_FRAME = { x: 0, y: 0, width: 393, height: 852 };

type SafeAreaProviderProps = ComponentProps<typeof RNSafeAreaProvider>;

/**
 * Drop-in replacement for react-native-safe-area-context's SafeAreaProvider.
 *
 * In the Shipper web preview (Metro dev server on web), the library measures
 * CSS env(safe-area-inset-*) — always 0 in an iframe — and overwrites any
 * initialMetrics with zeros, so SafeAreaView/useSafeAreaInsets stop working.
 * This shim pins fixed iPhone insets via context on web+dev only; everywhere
 * else (Expo Go, real devices, exported/published builds) it is a pass-through
 * to the real provider. Do not modify or remove this file.
 */
export function SafeAreaProvider({
  children,
  ...props
}: SafeAreaProviderProps) {
  if (Platform.OS !== "web" || !__DEV__) {
    return <RNSafeAreaProvider {...props}>{children}</RNSafeAreaProvider>;
  }
  return (
    <RNSafeAreaProvider {...props}>
      <SafeAreaFrameContext.Provider value={PREVIEW_FRAME}>
        <SafeAreaInsetsContext.Provider value={PREVIEW_INSETS}>
          {children}
        </SafeAreaInsetsContext.Provider>
      </SafeAreaFrameContext.Provider>
    </RNSafeAreaProvider>
  );
}
