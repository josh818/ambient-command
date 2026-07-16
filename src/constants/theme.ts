// Ambient Command — Design System
// A technical, premium dark-first theme for sensor monitoring & control.

export const colors = {
  // Brand
  primary: '#2DD4BF', // teal — "live / connected"
  primaryDark: '#14B8A6',
  accent: '#818CF8', // indigo accent
  // Status
  online: '#34D399',
  offline: '#9CA3AF',
  warning: '#FBBF24',
  danger: '#F87171',
  // Surfaces (dark)
  bg: '#0B1120',
  surface: '#111827',
  surfaceAlt: '#1F2937',
  border: '#243042',
  // Text
  text: '#F8FAFC',
  textMuted: '#94A3B8',
  textFaint: '#64748B',
} as const;

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
  online: { label: 'Online', color: colors.online, bg: 'rgba(52,211,153,0.12)' },
  offline: { label: 'Offline', color: colors.offline, bg: 'rgba(156,163,175,0.12)' },
  warning: { label: 'Warning', color: colors.warning, bg: 'rgba(251,191,36,0.12)' },
  unknown: { label: 'No Data', color: colors.textFaint, bg: 'rgba(100,116,139,0.12)' },
};
