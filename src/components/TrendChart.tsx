import { View, Text } from 'react-native';
import Svg, { Path, Line, Rect, Circle } from 'react-native-svg';
import { colors, fonts } from '../constants/theme';
import type { TrendPoint } from '../lib/measurementData';

// Multi-series engineering trend chart (inline SVG), per the dataviz specs:
// - 2px lines, round join/cap; ≥8px end markers with a 2px surface ring
// - hairline SOLID gridlines in a recessive off-surface gray (never dashed)
// - one shared y-axis (never dual-axis); labels wear text tokens only
// - sparse time labels on x; legend row for ≥2 series / background bands
// - optional shaded background bands (e.g. "pressure switch closed" spans)
// - optional step interpolation for state signals (valve open/closed)
//
// Series colors chosen to stay maximally distinguishable AND legible on the
// Seekaleak deep-indigo surface (#111147), leaning on the brand palette.

export const TREND_COLORS = {
  blue: '#6FC7F0', // slot 1 — pressure, battery volts/amps, valve state (sky, pops on indigo)
  orange: '#FEBE64', // slot 2 — charge volts/amps (brand amber)
  aqua: '#7EE2BE', // flow (brand mint)
  yellow: '#B7A9F0', // temperature (lifted brand purple, distinct from indigo bg)
  red: '#E07259', // leak events (brand coral)
} as const;

export interface TrendChartSeries {
  label: string;
  color: string;
  points: TrendPoint[];
}

export interface TimeBand {
  start: number; // epoch ms
  end: number; // epoch ms
}

export interface XTick {
  t: number; // epoch ms
  label: string;
}

interface Props {
  series: TrendChartSeries[];
  width: number;
  height?: number;
  /** Fixed time domain so bands + lines + empty edges stay honest. */
  tStart: number;
  tEnd: number;
  xTicks: XTick[];
  yFormat?: (v: number) => string;
  /** Step interpolation (state signals) instead of point-to-point. */
  step?: boolean;
  /** Fixed y domain (e.g. [0,1] for binary state charts). */
  yDomain?: [number, number];
  /** Explicit y tick values (defaults to domain min/mid/max). */
  yTicks?: number[];
  /** Shaded background spans (drawn behind the grid + lines). */
  bands?: TimeBand[];
  bandColor?: string;
  /** Legend label for the bands (renders a square swatch). */
  bandLabel?: string;
}

const PAD_LEFT = 42; // y tick label gutter
const PAD_RIGHT = 10;
const PAD_TOP = 10;
const PAD_BOTTOM = 22; // x tick label band — inside the height, never clipped

function defaultFormat(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1000) return `${Math.round(v / 100) / 10}k`;
  if (abs >= 100) return `${Math.round(v)}`;
  return `${Math.round(v * 10) / 10}`;
}

export function TrendChart({
  series,
  width,
  height = 170,
  tStart,
  tEnd,
  xTicks,
  yFormat = defaultFormat,
  step = false,
  yDomain,
  yTicks,
  bands,
  bandColor = 'rgba(148,163,184,0.16)',
  bandLabel,
}: Props) {
  const plotW = Math.max(width - PAD_LEFT - PAD_RIGHT, 10);
  const plotH = height - PAD_TOP - PAD_BOTTOM;
  const baseline = PAD_TOP + plotH;
  const tSpan = Math.max(tEnd - tStart, 1);

  // Shared y domain across every series (one axis, never two).
  let lo: number;
  let hi: number;
  if (yDomain) {
    [lo, hi] = yDomain;
  } else {
    lo = Infinity;
    hi = -Infinity;
    for (const s of series) {
      for (const p of s.points) {
        if (p.value < lo) lo = p.value;
        if (p.value > hi) hi = p.value;
      }
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
      lo = 0;
      hi = 1;
    }
    if (lo === hi) {
      // flat series — open the domain so the line sits mid-plot
      lo -= lo === 0 ? 1 : Math.abs(lo) * 0.1;
      hi += hi === 0 ? 1 : Math.abs(hi) * 0.1;
    } else {
      const pad = (hi - lo) * 0.06;
      lo -= pad;
      hi += pad;
    }
  }
  const ySpan = hi - lo || 1;

  const x = (t: number) => PAD_LEFT + ((t - tStart) / tSpan) * plotW;
  const y = (v: number) => PAD_TOP + plotH - ((v - lo) / ySpan) * plotH;

  const ticks = yTicks ?? [lo, lo + ySpan / 2, hi];

  const paths = series.map((s) => {
    if (s.points.length === 0) return '';
    const parts: string[] = [];
    let prev: TrendPoint | null = null;
    for (const p of s.points) {
      const px = x(p.t).toFixed(1);
      const py = y(p.value).toFixed(1);
      if (!prev) {
        parts.push(`M ${px} ${py}`);
      } else if (step) {
        // horizontal-then-vertical: hold the previous state until the sample
        parts.push(`L ${px} ${y(prev.value).toFixed(1)}`, `L ${px} ${py}`);
      } else {
        parts.push(`L ${px} ${py}`);
      }
      prev = p;
    }
    return parts.join(' ');
  });

  const showLegend = series.length >= 2 || !!bandLabel;

  return (
    <View>
      <Svg width={width} height={height}>
        {/* Shaded state bands — behind everything */}
        {bands?.map((b, i) => {
          const bx = Math.max(PAD_LEFT, x(b.start));
          const bw = Math.max(2, Math.min(PAD_LEFT + plotW, x(b.end)) - bx);
          if (bx > PAD_LEFT + plotW) return null;
          return (
            <Rect
              key={i}
              x={bx}
              y={PAD_TOP}
              width={bw}
              height={plotH}
              fill={bandColor}
            />
          );
        })}

        {/* Hairline solid gridlines — recessive */}
        {ticks.map((tv, i) => (
          <Line
            key={i}
            x1={PAD_LEFT}
            y1={y(tv)}
            x2={PAD_LEFT + plotW}
            y2={y(tv)}
            stroke={colors.border}
            strokeWidth={1}
          />
        ))}

        {/* Series lines — 2px, round join/cap */}
        {paths.map((d, i) =>
          d ? (
            <Path
              key={i}
              d={d}
              stroke={series[i].color}
              strokeWidth={2}
              fill="none"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null,
        )}

        {/* End markers with a 2px surface ring */}
        {series.map((s, i) => {
          const last = s.points[s.points.length - 1];
          if (!last) return null;
          return (
            <Circle
              key={i}
              cx={x(last.t)}
              cy={y(last.value)}
              r={4}
              fill={s.color}
              stroke={colors.surface}
              strokeWidth={2}
            />
          );
        })}

        {/* Baseline */}
        <Rect x={PAD_LEFT} y={baseline} width={plotW} height={1} fill={colors.border} />
      </Svg>

      {/* Y tick labels — text tokens, never the series color */}
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0 }}>
        {ticks.map((tv, i) => (
          <Text
            key={i}
            numberOfLines={1}
            style={{
              position: 'absolute',
              left: 0,
              top: y(tv) - 6,
              width: PAD_LEFT - 6,
              textAlign: 'right',
              color: colors.textFaint,
              fontSize: 10,
              fontFamily: fonts.mono,
              fontVariant: ['tabular-nums'],
            }}
          >
            {yFormat(tv)}
          </Text>
        ))}
      </View>

      {/* Sparse time labels */}
      <View
        pointerEvents="none"
        style={{ position: 'absolute', left: 0, top: baseline + 6, width }}
      >
        {xTicks.map((tk) => (
          <Text
            key={tk.t}
            numberOfLines={1}
            style={{
              position: 'absolute',
              left: Math.min(Math.max(x(tk.t) - 34, 0), width - 68),
              width: 68,
              textAlign: 'center',
              color: colors.textFaint,
              fontSize: 10,
              fontFamily: fonts.mono,
            }}
          >
            {tk.label}
          </Text>
        ))}
      </View>

      {/* Legend — always present for ≥2 identities (series or band) */}
      {showLegend && (
        <View className="flex-row flex-wrap items-center" style={{ marginTop: 8, gap: 14 }}>
          {series.map((s) => (
            <View key={s.label} className="flex-row items-center">
              <View
                style={{ width: 12, height: 3, borderRadius: 2, backgroundColor: s.color }}
              />
              <Text style={{ color: colors.textMuted, fontSize: 11, marginLeft: 5 }}>
                {s.label}
              </Text>
            </View>
          ))}
          {bandLabel ? (
            <View className="flex-row items-center">
              <View
                style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: bandColor }}
              />
              <Text style={{ color: colors.textMuted, fontSize: 11, marginLeft: 5 }}>
                {bandLabel}
              </Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}
