import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { colors } from '../constants/theme';
import { trackEvent } from '../lib/analytics';
import { type Feature } from '../lib/subscription';

export function PremiumBadge({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const small = size === 'sm';
  return (
    <View
      className="flex-row items-center self-start rounded-full"
      style={{
        backgroundColor: 'rgba(45,212,191,0.15)',
        paddingHorizontal: small ? 8 : 10,
        paddingVertical: small ? 2 : 4,
      }}
    >
      <Ionicons name="star" size={small ? 10 : 12} color={colors.primary} />
      <Text
        style={{
          color: colors.primary,
          fontSize: small ? 10 : 12,
          fontWeight: '800',
          letterSpacing: 0.5,
          marginLeft: 4,
        }}
      >
        PREMIUM
      </Text>
    </View>
  );
}

interface PremiumGateProps {
  title: string;
  description: string;
  icon?: string;
  feature?: Feature;
}

/**
 * Inline upsell card shown in place of a premium-only feature for free users.
 */
export function PremiumGate({ title, description, icon = 'lock-closed', feature }: PremiumGateProps) {
  const router = useRouter();

  useEffect(() => {
    if (feature) trackEvent({ type: 'gate_hit', feature });
  }, [feature]);
  return (
    <View
      className="rounded-2xl p-5 items-center"
      style={{
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.primary + '40',
        borderStyle: 'dashed',
      }}
    >
      <View
        className="w-12 h-12 rounded-full items-center justify-center mb-3"
        style={{ backgroundColor: 'rgba(45,212,191,0.15)' }}
      >
        <Ionicons name={icon as any} size={24} color={colors.primary} />
      </View>
      <PremiumBadge size="md" />
      <Text
        style={{ color: colors.text, fontSize: 16, fontWeight: '700', marginTop: 8, textAlign: 'center' }}
      >
        {title}
      </Text>
      <Text
        style={{
          color: colors.textMuted,
          fontSize: 13,
          marginTop: 4,
          textAlign: 'center',
          lineHeight: 19,
        }}
      >
        {description}
      </Text>
      <Pressable
        onPress={() => {
          trackEvent({ type: 'upgrade_viewed' });
          router.push('/settings/subscription');
        }}
        className="rounded-xl py-3 px-6 mt-4 active:opacity-80"
        style={{ backgroundColor: colors.primary }}
      >
        <Text style={{ color: colors.bg, fontSize: 14, fontWeight: '700' }}>Upgrade to Premium</Text>
      </Pressable>
    </View>
  );
}
