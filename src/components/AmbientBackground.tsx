import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Svg, {
  Defs,
  RadialGradient,
  Pattern,
  Stop,
  Rect,
  Circle,
} from 'react-native-svg';
import { colors } from '../constants/theme';

// ============================================================
// AmbientBackground — the Seekaleak "mission-control" wash.
//
// A full-bleed, non-interactive SVG behind the brand-moment
// screens (dashboard + auth). Warm corner-bleed radial gradients
// over the deep-indigo base, plus a faint dotted grid. Kept
// deliberately SUBTLE — atmosphere, not a party.
//
// Web-safe: pure react-native-svg (no expo-linear-gradient).
// Gradients use the default objectBoundingBox units so they scale
// with the 100%×100% canvas; the dotted grid uses a userSpaceOnUse
// tile so the dot pitch stays constant regardless of viewport size.
// ============================================================
export function AmbientBackground({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <Svg
      width="100%"
      height="100%"
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, style]}
    >
      <Defs>
        {/* Warm coral → amber bleed from the bottom-left corner */}
        <RadialGradient id="ab-warm" cx="0%" cy="100%" r="95%">
          <Stop offset="0%" stopColor={colors.danger} stopOpacity={0.16} />
          <Stop offset="45%" stopColor={colors.warning} stopOpacity={0.07} />
          <Stop offset="100%" stopColor={colors.warning} stopOpacity={0} />
        </RadialGradient>
        {/* Purple accent from the top-right corner */}
        <RadialGradient id="ab-purple" cx="100%" cy="0%" r="95%">
          <Stop offset="0%" stopColor={colors.accent} stopOpacity={0.14} />
          <Stop offset="100%" stopColor={colors.accent} stopOpacity={0} />
        </RadialGradient>
        {/* Faint mint lift from the top-left corner */}
        <RadialGradient id="ab-mint" cx="0%" cy="0%" r="70%">
          <Stop offset="0%" stopColor={colors.primary} stopOpacity={0.07} />
          <Stop offset="100%" stopColor={colors.primary} stopOpacity={0} />
        </RadialGradient>
        {/* Subtle dotted grid — constant 26px pitch */}
        <Pattern
          id="ab-dots"
          x={0}
          y={0}
          width={26}
          height={26}
          patternUnits="userSpaceOnUse"
        >
          <Circle cx={1} cy={1} r={1} fill="rgba(255,255,255,0.035)" />
        </Pattern>
      </Defs>

      {/* Base indigo */}
      <Rect x="0" y="0" width="100%" height="100%" fill={colors.bg} />
      {/* Corner-bleed washes (stacked, each fades to transparent) */}
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#ab-warm)" />
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#ab-purple)" />
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#ab-mint)" />
      {/* Dotted grid on top */}
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#ab-dots)" />
    </Svg>
  );
}
