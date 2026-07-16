import { View, Text } from 'react-native';
import Svg, { Path, Line, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { colors } from '../constants/theme';
import type { HistorySeries } from '../lib/history';

interface Props {
  series: HistorySeries;
  width: number;
  height?: number;
  unit?: string;
  color?: string;
}

export function LineChart({
  series,
  width,
  height = 180,
  unit = '',
  color = colors.primary,
}: Props) {
  const padX = 8;
  const padTop = 12;
  const padBottom = 22;
  const chartW = Math.max(width - padX * 2, 10);
  const chartH = height - padTop - padBottom;

  const { points, min, max } = series;
  const range = max - min || 1;

  const coords = points.map((p, i) => {
    const x = padX + (points.length === 1 ? 0 : (i / (points.length - 1)) * chartW);
    const y = padTop + chartH - ((p.value - min) / range) * chartH;
    return { x, y };
  });

  const linePath = coords
    .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(' ');

  const areaPath =
    coords.length > 0
      ? `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${(padTop + chartH).toFixed(
          1,
        )} L ${coords[0].x.toFixed(1)} ${(padTop + chartH).toFixed(1)} Z`
      : '';

  const last = coords[coords.length - 1];

  // 4 horizontal gridlines
  const gridYs = [0, 0.25, 0.5, 0.75, 1].map((f) => padTop + chartH * f);
  const labelVals = [max, min + range * 0.5, min];

  return (
    <View>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="area" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="0.28" />
            <Stop offset="1" stopColor={color} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        {gridYs.map((y, i) => (
          <Line
            key={i}
            x1={padX}
            y1={y}
            x2={padX + chartW}
            y2={y}
            stroke={colors.border}
            strokeWidth={1}
            strokeDasharray="3 5"
          />
        ))}
        {areaPath ? <Path d={areaPath} fill="url(#area)" /> : null}
        {linePath ? (
          <Path d={linePath} stroke={color} strokeWidth={2.5} fill="none" strokeLinejoin="round" />
        ) : null}
        {last ? (
          <>
            <Circle cx={last.x} cy={last.y} r={5} fill={color} />
            <Circle cx={last.x} cy={last.y} r={9} fill={color} fillOpacity={0.25} />
          </>
        ) : null}
      </Svg>
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: padTop,
          height: chartH,
          justifyContent: 'space-between',
        }}
        pointerEvents="none"
      >
        {labelVals.map((v, i) => (
          <Text key={i} style={{ color: colors.textFaint, fontSize: 10 }}>
            {Math.round(v * 10) / 10}
            {unit}
          </Text>
        ))}
      </View>
    </View>
  );
}
