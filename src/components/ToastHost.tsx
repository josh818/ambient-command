import { useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../constants/theme';
import { useToasts, dismissToast, type NotifyKind, type Toast } from '../lib/notify';

const kindMeta: Record<NotifyKind, { icon: string; color: string }> = {
  success: { icon: 'checkmark-circle', color: colors.online },
  error: { icon: 'alert-circle', color: colors.danger },
  info: { icon: 'information-circle', color: colors.accent },
  pending: { icon: 'sync', color: colors.primary },
};

function ToastRow({ toast }: { toast: Toast }) {
  const meta = kindMeta[toast.kind];
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 120,
      friction: 14,
    }).start();
  }, [anim]);

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [
          {
            translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }),
          },
        ],
        marginTop: 8,
      }}
    >
      <Pressable
        onPress={() => dismissToast(toast.id)}
        className="flex-row items-center rounded-2xl px-3.5 py-3 active:opacity-80"
        style={{
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: meta.color + '55',
          shadowColor: '#000',
          shadowOpacity: 0.3,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        }}
      >
        <View
          className="w-8 h-8 rounded-full items-center justify-center mr-3"
          style={{ backgroundColor: meta.color + '22' }}
        >
          <Ionicons name={meta.icon as any} size={17} color={meta.color} />
        </View>
        <View className="flex-1">
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>
            {toast.title}
          </Text>
          {toast.message ? (
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 1 }} numberOfLines={2}>
              {toast.message}
            </Text>
          ) : null}
        </View>
        {toast.kind !== 'pending' && (
          <Ionicons name="close" size={16} color={colors.textFaint} style={{ marginLeft: 8 }} />
        )}
      </Pressable>
    </Animated.View>
  );
}

export function ToastHost() {
  const toasts = useToasts();
  if (toasts.length === 0) return null;

  return (
    <SafeAreaView
      edges={['top']}
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
      }}
    >
      <View pointerEvents="box-none" style={{ paddingHorizontal: 14, paddingTop: Platform.select({ web: 8, default: 0 }) }}>
        {toasts.map((t) => (
          <ToastRow key={t.id} toast={t} />
        ))}
      </View>
    </SafeAreaView>
  );
}
