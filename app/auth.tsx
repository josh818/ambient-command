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
import { colors } from '../src/constants/theme';
import {
  AUTH_CONFIG,
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle,
} from '../lib/auth-client';

const TEST_EMAIL = 'demo@ambientcommand.app';
const TEST_PASSWORD = 'ambient-demo-1234';
const TEST_NAME = 'Demo User';

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
    const result =
      mode === 'signin'
        ? await signInWithEmail(email.trim(), password)
        : await signUpWithEmail(email.trim(), password, name.trim());
    setLoading(false);
    if (!result.success) {
      setError(result.error?.message ?? 'Something went wrong');
      return;
    }
    // Test accounts (demo / josh-tester @ambientcommand.app) get their demo
    // data + device assignments seeded on every sign-in. No-op for real users.
    if (email.trim().toLowerCase().endsWith('@ambientcommand.app')) {
      seedDemoData();
    }
    router.replace('/(tabs)');
  };

  const handleTestAccount = async () => {
    setError(null);
    setLoading(true);
    // Try signing in first; if the demo account doesn't exist yet, create it.
    let result = await signInWithEmail(TEST_EMAIL, TEST_PASSWORD);
    if (!result.success) {
      result = await signUpWithEmail(TEST_EMAIL, TEST_PASSWORD, TEST_NAME);
    }
    setLoading(false);
    if (!result.success) {
      setError(result.error?.message ?? 'Could not start the demo session');
      return;
    }
    // Fire-and-forget: never blocks or fails the demo sign-in itself.
    seedDemoData();
    router.replace('/(tabs)');
  };

  const handleGoogle = async () => {
    setError(null);
    setLoading(true);
    const result = await signInWithGoogle('/(tabs)');
    setLoading(false);
    if (!result.success) {
      setError(result.error?.message ?? 'Google sign-in failed');
    }
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.bg }}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="items-center mb-8">
            <View
              className="w-16 h-16 rounded-2xl items-center justify-center mb-4"
              style={{ backgroundColor: 'rgba(126,226,190,0.12)' }}
            >
              <Ionicons name="pulse" size={32} color={colors.primary} />
            </View>
            <Text style={{ color: colors.text, fontSize: 26, fontWeight: '800' }}>
              Ambient Command
            </Text>
            <Text style={{ color: colors.textFaint, fontSize: 14, marginTop: 6 }}>
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
                fontSize: 15,
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
              fontSize: 15,
            }}
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
              fontSize: 15,
            }}
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
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600', marginLeft: 8 }}>
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
            <Text style={{ color: colors.primary, fontSize: 15, fontWeight: '700', marginLeft: 8 }}>
              Try with Test Account
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
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
