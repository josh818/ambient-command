import Svg, { Polyline, Circle } from 'react-native-svg';
import { colors } from '../constants/theme';

/**
 * Lightweight inline sparkline — a bare polyline over ≤20 recent values.
 * Renders nothing when there aren't at least two real data points.
 */
export function Sparkline({
  data,
  width = 68,
  height = 26,
  color = colors.primary,
}: {
  data: number[] | null;
  width?: number;
  height?: number;
  color?: string;
}) {
  if (!data || data.length < 2) return null;

  const pad = 2;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = (width - pad * 2) / (data.length - 1);

  const pts = data.map((v, i) => {
    const x = pad + i * stepX;
    const y = pad + (height - pad * 2) * (1 - (v - min) / range);
    return { x, y };
  });
  const pointsAttr = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];

  return (
    <Svg width={width} height={height}>
      <Polyline
        points={pointsAttr}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeOpacity={0.9}
      />
      <Circle cx={last.x} cy={last.y} r={2.2} fill={color} />
    </Svg>
  );
}
