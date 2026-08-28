import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors } from '../../src/constants/theme';
import { trackEvent } from '../../src/lib/analytics';
import { useEffect } from 'react';

const premiumFeatures = [
  'Real-time smart alerts (leak, freeze, offline)',
  'Unlimited metric history & trend charts',
  'Remote control of all controllable devices',
  'Cloud sync across unlimited devices',
  'Priority support',
];

export default function SubscriptionScreen() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [redeemed, setRedeemed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    trackEvent({ type: 'upgrade_viewed' });
  }, []);

  const redeem = async () => {
    const c = code.trim().toUpperCase();
    if (!c) {
      setError('Enter an access code');
      return;
    }
    setRedeeming(true);
    setError(null);
    // Simulate validating the code against the partner registry.
    await new Promise((r) => setTimeout(r, 700));
    // Valid codes unlock premium for free (e.g. partner / installer codes).
    if (c === 'BHFREE' || c.startsWith('BH-')) {
      setRedeemed(true);
      setError(null);
    } else {
      setError('That code is not valid');
    }
    setRedeeming(false);
  };

  const subscribe = async () => {
    if (redeemed) return;
    setSubscribing(true);
    await new Promise((r) => setTimeout(r, 900));
    setRedeemed(true);
    setSubscribing(false);
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.bg }} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <View className="flex-row items-center px-5 py-3">
          <Pressable
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full items-center justify-center active:opacity-70"
            style={{ backgroundColor: colors.surface }}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginLeft: 12 }}>
            Subscription
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          {redeemed && (
            <View
              className="rounded-2xl p-4 mb-4 flex-row items-center"
              style={{ backgroundColor: 'rgba(126,226,190,0.12)', borderWidth: 1, borderColor: colors.online + '55' }}
            >
              <Ionicons name="checkmark-circle" size={22} color={colors.online} />
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600', marginLeft: 10, flex: 1 }}>
                Premium unlocked with your access code. Enjoy full monitoring!
              </Text>
            </View>
          )}

          <View
            className="rounded-3xl p-6"
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.primary + '55',
            }}
          >
            <View
              className="self-start px-3 py-1 rounded-full mb-3"
              style={{ backgroundColor: 'rgba(126,226,190,0.15)' }}
            >
              <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>
                PREMIUM
              </Text>
            </View>
            <View className="flex-row items-end">
              <Text style={{ color: colors.text, fontSize: 38, fontWeight: '800' }}>$4.99</Text>
              <Text style={{ color: colors.textFaint, fontSize: 15, marginBottom: 7, marginLeft: 4 }}>
                / month
              </Text>
            </View>
            <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>
              Cancel anytime. Full access to advanced monitoring.
            </Text>

            <View className="mt-5">
              {premiumFeatures.map((f) => (
                <View key={f} className="flex-row items-start mb-2.5">
                  <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                  <Text style={{ color: colors.text, fontSize: 14, marginLeft: 8, flex: 1, lineHeight: 20 }}>
                    {f}
                  </Text>
                </View>
              ))}
            </View>

            <Pressable
              disabled={redeemed || subscribing}
              onPress={subscribe}
              className="rounded-2xl py-3.5 items-center mt-4 active:opacity-80"
              style={{ backgroundColor: redeemed ? colors.surfaceAlt : colors.primary }}
            >
              {subscribing ? (
                <ActivityIndicator color={colors.bg} />
              ) : (
                <Text style={{ color: redeemed ? colors.textFaint : colors.bg, fontSize: 16, fontWeight: '700' }}>
                  {redeemed ? 'Premium Active' : 'Subscribe for $4.99/mo'}
                </Text>
              )}
            </Pressable>
          </View>

          <View className="flex-row items-center my-6">
            <View className="flex-1 h-px" style={{ backgroundColor: colors.border }} />
            <Text style={{ color: colors.textFaint, fontSize: 12, marginHorizontal: 12 }}>OR</Text>
            <View className="flex-1 h-px" style={{ backgroundColor: colors.border }} />
          </View>

          <View
            className="rounded-2xl p-5"
            style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
          >
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
              Have an access code?
            </Text>
            <Text style={{ color: colors.textFaint, fontSize: 13, marginTop: 4 }}>
              Installers & partners can unlock premium for free.
            </Text>
            <View className="flex-row items-center mt-3">
              <TextInput
                value={code}
                onChangeText={(t) => {
                  setCode(t);
                  setError(null);
                }}
                placeholder="Enter code"
                placeholderTextColor={colors.textFaint}
                autoCapitalize="characters"
                autoCorrect={false}
                className="flex-1 rounded-xl px-3 py-3"
                style={{
                  backgroundColor: colors.surfaceAlt,
                  color: colors.text,
                  fontSize: 15,
                  borderWidth: 1,
                  borderColor: error ? colors.danger : colors.border,
                }}
                onSubmitEditing={redeem}
                returnKeyType="done"
              />
              <Pressable
                onPress={redeem}
                disabled={redeeming}
                className="ml-2 px-5 py-3 rounded-xl active:opacity-80"
                style={{ backgroundColor: colors.accent, opacity: redeeming ? 0.7 : 1, minWidth: 86, alignItems: 'center' }}
              >
                {redeeming ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Redeem</Text>
                )}
              </Pressable>
            </View>
            {error && (
              <Text style={{ color: colors.danger, fontSize: 12, marginTop: 8 }}>{error}</Text>
            )}
            <Text style={{ color: colors.textFaint, fontSize: 11, marginTop: 10 }}>
              Try code “BHFREE” for a free unlock.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
