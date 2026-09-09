import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { colors, fonts } from '../src/constants/theme';
import { AmbientBackground } from '../src/components/AmbientBackground';
import {
  AUTH_CONFIG,
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle,
} from '../lib/auth-client';

const TEST_EMAIL = 'demo@ambientcommand.app';

export default function AuthScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ensureDemoData = useMutation(api.demo.ensureDemoData);

  // Seed the demo account with scenes + sensor settings so dashboards aren't
  // empty on first sign-in. Idempotent server-side; retried briefly because
  // the Convex auth token can lag the Better Auth sign-in by a moment.
  const seedDemoData = (attempt = 0) => {
    ensureDemoData({}).catch(() => {
      if (attempt < 4) {
        setTimeout(() => seedDemoData(attempt + 1), 1200);
      }
    });
  };

  const handleSubmit = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError('Please enter your email and password');
      return;
    }
    setLoading(true);
    try {
      const result = mode === 'signin'
        ? await signInWithEmail(email.trim(), password)
        : await signUpWithEmail(email.trim(), password, name.trim());
      if (!result.success) {
        setError(result.error?.message ?? 'Something went wrong');
        return;
      }
      if (email.trim().toLowerCase().endsWith('@ambientcommand.app')) seedDemoData();
      router.replace('/(tabs)');
    } catch {
      setError('Unable to connect. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleTestAccount = () => {
    setMode('signin');
    setEmail(TEST_EMAIL);
    setPassword('');
    setError('Enter the test account password to continue.');
  };

  const handleGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await signInWithGoogle('/(tabs)');
      if (!result.success) setError(result.error?.message ?? 'Google sign-in failed');
    } catch {
      setError('Unable to connect to Google. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: 'transparent' }}>
      <AmbientBackground />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="items-center" style={{ marginBottom: 40 }}>
            {/* App mark — mint-tinted rounded square with a soft mint glow */}
            <View
              className="w-20 h-20 rounded-3xl items-center justify-center"
              style={{
                backgroundColor: 'rgba(126,226,190,0.12)',
                borderWidth: 1,
                borderColor: 'rgba(126,226,190,0.30)',
                shadowColor: colors.primary,
                shadowOpacity: 0.4,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 0 },
              }}
            >
              <Ionicons name="pulse" size={38} color={colors.primary} />
            </View>

            {/* Product name — Space Grotesk, large + light */}
            <Text
              style={{
                color: colors.text,
                fontSize: 32,
                fontWeight: '300',
                fontFamily: fonts.sans,
                marginTop: 24,
                textAlign: 'center',
              }}
            >
              Ambient Command
            </Text>

            {/* Tagline — Space Mono, small, uppercase, letter-spaced */}
            <Text
              style={{
                color: colors.primary,
                fontSize: 11,
                fontFamily: fonts.mono,
                letterSpacing: 2,
                marginTop: 12,
                textTransform: 'uppercase',
                textAlign: 'center',
              }}
            >
              Leak Detection · Valve Control
            </Text>

            <Text style={{ color: colors.textFaint, fontSize: 14, marginTop: 16, textAlign: 'center' }}>
              {mode === 'signin' ? 'Sign in to monitor your sensors' : 'Create your account'}
            </Text>
          </View>

          {mode === 'signup' && (
            <TextInput
              className="rounded-xl px-4 py-3.5 mb-3"
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                color: colors.text,
                fontSize: 16,
              }}
              placeholder="Name (optional)"
              placeholderTextColor={colors.textFaint}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          )}

          <TextInput
            className="rounded-xl px-4 py-3.5 mb-3"
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              color: colors.text,
              fontSize: 16,
            }}
            accessibilityLabel="Email address"
            autoComplete="email"
            placeholder="Email"
            placeholderTextColor={colors.textFaint}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TextInput
            className="rounded-xl px-4 py-3.5 mb-3"
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              color: colors.text,
              fontSize: 16,
            }}
            accessibilityLabel="Password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            onSubmitEditing={() => { if (!loading) void handleSubmit(); }}
            returnKeyType="go"
            placeholder="Password"
            placeholderTextColor={colors.textFaint}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {error && (
            <Text style={{ color: '#f87171', fontSize: 13, marginBottom: 10 }}>{error}</Text>
          )}

          <Pressable
            onPress={handleSubmit}
            disabled={loading}
            className="rounded-xl py-4 items-center active:opacity-90"
            style={{ backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? (
              <ActivityIndicator color="#04201c" />
            ) : (
              <Text style={{ color: '#04201c', fontSize: 16, fontWeight: '700' }}>
                {mode === 'signin' ? 'Sign In' : 'Create Account'}
              </Text>
            )}
          </Pressable>

          {AUTH_CONFIG.googleEnabled && (
            <Pressable
              onPress={handleGoogle}
              disabled={loading}
              className="rounded-xl py-4 items-center mt-3 flex-row justify-center active:opacity-90"
              style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
            >
              <Ionicons name="logo-google" size={18} color={colors.text} />
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600', marginLeft: 8 }}>
                Continue with Google
              </Text>
            </Pressable>
          )}

          <Pressable
            onPress={handleTestAccount}
            disabled={loading}
            className="rounded-xl py-4 items-center mt-3 flex-row justify-center active:opacity-90"
            style={{ backgroundColor: 'rgba(126,226,190,0.10)', borderWidth: 1, borderColor: colors.primary }}
          >
            <Ionicons name="flask-outline" size={18} color={colors.primary} />
            <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '700', marginLeft: 8 }}>
              Use Test Account
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              if (loading) return;
              setError(null);
              setMode(mode === 'signin' ? 'signup' : 'signin');
            }}
            className="mt-6 items-center active:opacity-70"
          >
            <Text style={{ color: colors.textMuted, fontSize: 14 }}>
              {mode === 'signin'
                ? "Don't have an account? "
                : 'Already have an account? '}
              <Text style={{ color: colors.primary, fontWeight: '700' }}>
                {mode === 'signin' ? 'Sign up' : 'Sign in'}
              </Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
