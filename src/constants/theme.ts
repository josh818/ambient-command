// Ambient Command / Seekaleak — Design System
// Dark-first theme using the Seekaleak brand palette:
//   7EE2BE mint · DCF8EE light mint · A1C1B3 sage · 111147 deep indigo
//   503A9C purple · FEBE64 amber · E07259 coral · FFFFFF white

export const colors = {
  // Brand
  primary: '#7EE2BE', // Seekaleak mint — "live / connected"
  primaryDark: '#57C6A0', // darker mint for pressed/track states
  accent: '#503A9C', // Seekaleak purple accent
  // Status
  online: '#7EE2BE', // mint = healthy / valve open
  offline: '#A1C1B3', // sage
  warning: '#FEBE64', // amber
  danger: '#E07259', // coral
  // Surfaces (dark) — built around the brand's deep indigo 111147
  bg: '#0B0B2E', // slightly darker than surface so cards lift off the page
  surface: '#111147', // brand deep indigo
  surfaceAlt: '#1B1B5A', // one step lighter for tiles/insets
  border: '#2A2A66', // indigo-tinted hairline
  // Text
  text: '#F4FBF7', // near-white with a faint mint tint
  textMuted: '#A1C1B3', // sage
  textFaint: '#7C86AE', // muted indigo-grey
} as const;

// Brand typography — loaded on web via a Google Fonts <link> in app/+html.tsx.
// A single 'Space Grotesk' family carries every weight; 'Space Mono' is the
// technical/telemetry face.
export const fonts = { sans: 'Space Grotesk', mono: 'Space Mono' } as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
} as const;

// Font scale — capped at 28pt per responsive rules
export const fontSize = {
  caption: 12,
  small: 14,
  body: 16,
  lead: 18,
  title: 22,
  display: 26,
} as const;

export type SensorStatus = 'online' | 'offline' | 'warning' | 'unknown';

export const statusMeta: Record<
  SensorStatus,
  { label: string; color: string; bg: string }
> = {
  online: { label: 'Online', color: colors.online, bg: 'rgba(126,226,190,0.14)' },
  offline: { label: 'Offline', color: colors.offline, bg: 'rgba(161,193,179,0.12)' },
  warning: { label: 'Warning', color: colors.warning, bg: 'rgba(254,190,100,0.14)' },
  unknown: { label: 'No Data', color: colors.textFaint, bg: 'rgba(124,134,174,0.14)' },
};
