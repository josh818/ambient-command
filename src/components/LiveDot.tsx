import { useEffect, useRef } from 'react';
import { View, Animated, Easing } from 'react-native';
import { colors } from '../constants/theme';

/**
 * Subtle pulsing dot shown on sensors that are reporting live telemetry.
 * Pure JS-driven Animated loop — safe on native and web.
 */
export function LiveDot({ color = colors.online, size = 8 }: { color?: string; size?: number }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 0,
          useNativeDriver: false,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] });
  const haloOpacity = pulse.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.5, 0.12, 0] });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          opacity: haloOpacity,
          transform: [{ scale: haloScale }],
        }}
      />
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
}
