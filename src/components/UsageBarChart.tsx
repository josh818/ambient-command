import { View, Text, Pressable } from 'react-native';
import Svg, { Path, Line, Rect } from 'react-native-svg';
import { colors } from '../constants/theme';
import type { UsageBucket } from '../lib/usageHistory';

// Column chart for usage buckets, per the dataviz mark specs:
// - bars ≤ 24px thick, 4px rounded data-end, square at the baseline
// - ≥ 2px surface gap between adjacent bars (slot spacing guarantees it)
// - hairline solid gridlines in a recessive off-surface gray
// - labels/values wear text tokens, never the series color
// - no number on every bar — tap a column to inspect it (hover equivalent)

interface Props {
  buckets: UsageBucket[];
  width: number;
  height?: number;
  color?: string;
  selectedIndex?: number | null;
  onSelect?: (index: number | null) => void;
}

function niceCeil(value: number): number {
  if (value <= 0) return 1;
  const exp = Math.floor(Math.log10(value));
  const base = Math.pow(10, exp);
  const frac = value / base;
  const nice = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
  return nice * base;
}

function formatTick(v: number): string {
  if (v >= 1000) return `${Math.round(v / 100) / 10}k`;
  return `${Math.round(v * 10) / 10}`;
}

// Column with a 4px rounded top (data end) and a square baseline.
function columnPath(x: number, top: number, w: number, bottom: number): string {
  const h = bottom - top;
  if (h <= 0) return '';
  const r = Math.min(4, h, w / 2);
  return [
    `M ${x.toFixed(1)} ${bottom.toFixed(1)}`,
    `L ${x.toFixed(1)} ${(top + r).toFixed(1)}`,
    `Q ${x.toFixed(1)} ${top.toFixed(1)} ${(x + r).toFixed(1)} ${top.toFixed(1)}`,
    `L ${(x + w - r).toFixed(1)} ${top.toFixed(1)}`,
    `Q ${(x + w).toFixed(1)} ${top.toFixed(1)} ${(x + w).toFixed(1)} ${(top + r).toFixed(1)}`,
    `L ${(x + w).toFixed(1)} ${bottom.toFixed(1)}`,
    'Z',
  ].join(' ');
}

export function UsageBarChart({
  buckets,
  width,
  height = 190,
  color = colors.primary,
  selectedIndex = null,
  onSelect,
}: Props) {
  const padLeft = 34; // room for y tick labels
  const padRight = 4;
  const padTop = 8;
  const padBottom = 22;
  const chartW = Math.max(width - padLeft - padRight, 10);
  const chartH = height - padTop - padBottom;
  const baseline = padTop + chartH;

  const n = buckets.length;
  const max = niceCeil(Math.max(...buckets.map((b) => b.value), 0));
  const slot = chartW / Math.max(n, 1);
  const barW = Math.max(2, Math.min(24, slot - 2)); // ≥2px surface gap, ≤24px thick

  // Gridlines at 0 / 50% / 100% of the nice max — hairline, solid, recessive.
  const gridFracs = [0, 0.5, 1];

  // Sparse x labels: first, two interior, last.
  const labelIdx = new Set(
    n <= 8
      ? buckets.map((_, i) => i)
      : [0, Math.round((n - 1) / 3), Math.round((2 * (n - 1)) / 3), n - 1],
  );

  return (
    <View>
      <Svg width={width} height={height}>
        {gridFracs.map((f) => {
          const y = baseline - chartH * f;
          return (
            <Line
              key={f}
              x1={padLeft}
              y1={y}
              x2={padLeft + chartW}
              y2={y}
              stroke={colors.border}
              strokeWidth={1}
            />
          );
        })}
        {buckets.map((b, i) => {
          if (b.value <= 0) return null;
          const h = (b.value / max) * chartH;
          const x = padLeft + i * slot + (slot - barW) / 2;
          const dimmed = selectedIndex !== null && selectedIndex !== i;
          return (
            <Path
              key={b.start}
              d={columnPath(x, baseline - h, barW, baseline)}
              fill={color}
              opacity={dimmed ? 0.35 : 1}
            />
          );
        })}
        {/* Baseline on top of the columns' square ends */}
        <Rect x={padLeft} y={baseline} width={chartW} height={1} fill={colors.border} />
      </Svg>

      {/* Y tick labels — text tokens, never the series color */}
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0 }}>
        {gridFracs.map((f) => (
          <Text
            key={f}
            style={{
              position: 'absolute',
              left: 0,
              top: baseline - chartH * f - 6,
              width: padLeft - 6,
              textAlign: 'right',
              color: colors.textFaint,
              fontSize: 10,
              fontVariant: ['tabular-nums'],
            }}
          >
            {formatTick(max * f)}
          </Text>
        ))}
      </View>

      {/* X labels — sparse */}
      <View
        pointerEvents="none"
        style={{ position: 'absolute', left: padLeft, top: baseline + 6, width: chartW }}
      >
        {buckets.map((b, i) =>
          labelIdx.has(i) ? (
            <Text
              key={b.start}
              style={{
                position: 'absolute',
                left: i * slot + slot / 2 - 24,
                width: 48,
                textAlign: 'center',
                color: colors.textFaint,
                fontSize: 10,
              }}
            >
              {b.label}
            </Text>
          ) : null,
        )}
      </View>

      {/* Tap targets (hover-layer equivalent) — full-height slots, wider than the marks */}
      {onSelect && (
        <View
          style={{
            position: 'absolute',
            left: padLeft,
            top: 0,
            width: chartW,
            height: padTop + chartH,
            flexDirection: 'row',
          }}
        >
          {buckets.map((b, i) => (
            <Pressable
              key={b.start}
              onPress={() => onSelect(selectedIndex === i ? null : i)}
              style={{ width: slot, height: '100%' }}
              accessibilityRole="button"
              accessibilityLabel={`${b.label}: ${b.value}`}
            />
          ))}
        </View>
      )}
    </View>
  );
}
