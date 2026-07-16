import { Platform, StyleSheet, Text, View } from "react-native";
import type { ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

interface PreviewStatusBarProps {
  /**
   * Optional fixed glyph colour (e.g. "#fff" or "#000"). Omit for the default
   * auto-blend, which is almost always what you want.
   */
  tint?: string;
  /** Clock text. iOS uses 9:41 in all its marketing shots. */
  time?: string;
}

/**
 * PreviewStatusBar — a 1:1 iPhone-16 status bar (Dynamic Island + clock +
 * cellular / Wi-Fi / battery) and home indicator. Shipper-preview only.
 *
 * The clock and icons have NO background of their own — they blend onto whatever
 * is behind them via mix-blend-mode: difference, so they stay legible on any
 * background. The Dynamic Island is a separate solid-black sibling (it's the
 * hardware sensor cutout) and is never blended.
 *
 * It renders ONLY inside the Shipper sandbox preview and NOWHERE else: Expo Go is
 * native, and any app the user exports / publishes to the web is a production
 * build — both get the real OS status bar (or none), never this faux one.
 */
export function PreviewStatusBar({ tint, time = "9:41" }: PreviewStatusBarProps) {
  const insets = useSafeAreaInsets();

  // Show ONLY in the Shipper sandbox preview: it runs the Metro DEV server on
  // web (Platform.OS === "web" && __DEV__). Expo Go is native, and an exported /
  // published web build is production (__DEV__ === false) — so neither renders it.
  if (Platform.OS !== "web" || !__DEV__) return null;

  // No tint → white glyphs + difference blend (auto-adapts to any background).
  // Explicit tint → that flat colour, no blending.
  const glyph = tint ?? "#FFFFFF";
  const blend: ViewStyle | undefined = tint
    ? undefined
    : ({ mixBlendMode: "difference" } as unknown as ViewStyle);

  // The chrome row is a FIXED 59 tall (true iPhone status-bar geometry, keeps
  // the glyphs vertically aligned with the Dynamic Island) — independent of the
  // inset the app pads by, which is deliberately larger for breathing room.
  const BAR_HEIGHT = 59;
  const bottomInset = insets.bottom || 34;

  return (
    <>
      {/* Status bar row: clock in the left ear, icons in the right ear, the
          Dynamic Island reserved between them. The blend MUST live on this
          top-level element: it is absolutely positioned with a zIndex, which
          creates a stacking context that ISOLATES blending — a blend applied to
          a glyph inside would only blend against the bar's own transparent
          background (i.e. nothing) and the glyphs would stay white/invisible on
          light apps. On the bar itself, only the painted glyph pixels blend
          against the app behind. */}
      <View
        pointerEvents="none"
        style={[styles.bar, { height: BAR_HEIGHT }, blend]}
      >
        <View style={styles.ear}>
          <Text style={[styles.time, { color: glyph }]}>{time}</Text>
        </View>
        <View style={styles.islandSpacer} />
        <View style={[styles.ear, styles.earRight]}>
          <View style={styles.icons}>
            {/* Cellular — four bars */}
            <View style={styles.cellular}>
              <View style={[styles.sigBar, { height: 4, backgroundColor: glyph }]} />
              <View style={[styles.sigBar, { height: 6.3, backgroundColor: glyph }]} />
              <View style={[styles.sigBar, { height: 8.6, backgroundColor: glyph }]} />
              <View style={[styles.sigBar, { height: 11, backgroundColor: glyph }]} />
            </View>
            {/* Wi-Fi */}
            <Ionicons name="wifi" size={17} color={glyph} />
            {/* Battery — body + fill + terminal nub */}
            <View style={styles.batteryWrap}>
              <View style={[styles.batteryBody, { borderColor: glyph }]}>
                <View style={[styles.batteryFill, { backgroundColor: glyph }]} />
              </View>
              <View style={[styles.batteryNub, { backgroundColor: glyph }]} />
            </View>
          </View>
        </View>
      </View>

      {/* Dynamic Island — solid, NEVER blended (it is the sensor cutout) */}
      <View pointerEvents="none" style={styles.island} />

      {/* Home indicator */}
      <View
        pointerEvents="none"
        style={[
          styles.homeIndicator,
          { bottom: Math.max(bottomInset - 26, 8), backgroundColor: glyph },
          blend,
        ]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    flexDirection: "row",
    alignItems: "center",
  },
  ear: { flex: 1, alignItems: "center", justifyContent: "center" },
  earRight: { alignItems: "flex-end", paddingRight: 22 },
  islandSpacer: { width: 125 },
  time: {
    fontSize: 17,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
    letterSpacing: 0.2,
  },
  icons: { flexDirection: "row", alignItems: "center", gap: 7 },
  cellular: { flexDirection: "row", alignItems: "flex-end", gap: 2, height: 11 },
  sigBar: { width: 3, borderRadius: 1 },
  batteryWrap: { flexDirection: "row", alignItems: "center" },
  batteryBody: {
    width: 24,
    height: 12,
    borderRadius: 3.5,
    borderWidth: 1,
    padding: 1.5,
    justifyContent: "center",
  },
  batteryFill: { flex: 1, borderRadius: 1.5 },
  batteryNub: {
    width: 1.6,
    height: 4.5,
    borderTopRightRadius: 1,
    borderBottomRightRadius: 1,
    marginLeft: 1,
  },
  island: {
    position: "absolute",
    top: 11,
    alignSelf: "center",
    width: 125,
    height: 37,
    borderRadius: 20,
    backgroundColor: "#000000",
    zIndex: 55,
  },
  homeIndicator: {
    position: "absolute",
    alignSelf: "center",
    width: 140,
    height: 5,
    borderRadius: 3,
    opacity: 0.9,
    zIndex: 50,
  },
});
