import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Animated, Easing } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/theme';
import type { SystemHealth } from '../lib/health';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SIZE = 172;
const STROKE = 12;
const R = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;

/**
 * Animated system-health gauge for the dashboard hero. Counts up from 0 on
 * mount, sweeps the ring, and shifts green → amber → red with the score band.
 */
export function HealthRing({
  health,
  onPress,
}: {
  health: SystemHealth;
  onPress?: () => void;
}) {
  const { score, color, statusLine, problemCount, bandLabel } = health;
  const progress = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const target = score === null ? 0 : score;
    const listener = progress.addListener(({ value }) =>
      setDisplay(Math.round(value)),
    );
    Animated.timing(progress, {
      toValue: target,
      duration: 1200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // animates SVG props + drives the count-up
    }).start();
    return () => progress.removeListener(listener);
  }, [score, progress]);

  const dashOffset = progress.interpolate({
    inputRange: [0, 100],
    outputRange: [CIRCUMFERENCE, 0],
  });

  const standby = score === null;
  // Soft mint glow only on the healthy/live state (all-clear, green band).
  const healthy = !standby && problemCount === 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`System health ${standby ? 'standby' : `${score} out of 100`}. ${statusLine}`}
      className="rounded-2xl items-center active:opacity-90"
      style={{
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: standby ? colors.border : color + '33',
        paddingVertical: 24,
        paddingHorizontal: 20,
        ...(healthy
          ? {
              shadowColor: colors.primary,
              shadowOpacity: 0.4,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 0 },
            }
          : null),
      }}
    >
      <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={SIZE} height={SIZE} style={{ transform: [{ rotate: '-90deg' }] }}>
          {/* Track */}
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            stroke={colors.surfaceAlt}
            strokeWidth={STROKE}
            fill="none"
          />
          {/* Soft glow behind the progress arc */}
          {!standby && (
            <AnimatedCircle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              stroke={color}
              strokeOpacity={0.18}
              strokeWidth={STROKE + 7}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
              strokeDashoffset={dashOffset as unknown as number}
            />
          )}
          {/* Progress arc */}
          <AnimatedCircle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            stroke={standby ? colors.border : color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            strokeDashoffset={dashOffset as unknown as number}
          />
        </Svg>

        {/* Center readout */}
        <View
          style={{
            position: 'absolute',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          pointerEvents="none"
        >
          {standby ? (
            <>
              <Ionicons name="cloud-outline" size={30} color={colors.textFaint} />
              <Text style={{ color: colors.textFaint, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginTop: 6 }}>
                AWAITING
              </Text>
            </>
          ) : (
            <>
              <Text style={{ color: colors.text, fontSize: 44, fontWeight: '800', lineHeight: 48 }}>
                {display}
              </Text>
              <Text
                style={{
                  color,
                  fontSize: 11,
                  fontWeight: '800',
                  letterSpacing: 1.5,
                  marginTop: 2,
                }}
              >
                {bandLabel}
              </Text>
            </>
          )}
        </View>
      </View>

      <Text style={{ color: colors.textFaint, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginTop: 14 }}>
        SYSTEM HEALTH
      </Text>
      <View className="flex-row items-center" style={{ marginTop: 6 }}>
        <Ionicons
          name={
            standby
              ? 'time-outline'
              : problemCount === 0
                ? 'shield-checkmark'
                : 'alert-circle'
          }
          size={15}
          color={standby ? colors.textFaint : problemCount === 0 ? colors.online : color}
        />
        <Text
          style={{
            color: standby ? colors.textMuted : problemCount === 0 ? colors.text : color,
            fontSize: 14,
            fontWeight: '700',
            marginLeft: 6,
          }}
        >
          {statusLine}
        </Text>
      </View>
      {problemCount > 0 && (
        <View className="flex-row items-center" style={{ marginTop: 8 }}>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>Tap to review</Text>
          <Ionicons name="chevron-forward" size={12} color={colors.textMuted} style={{ marginLeft: 2 }} />
        </View>
      )}
    </Pressable>
  );
}
