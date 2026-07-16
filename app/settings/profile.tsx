import { useState, useEffect } from 'react';
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
import { useSession } from '../../lib/auth-client';
import { useProfile } from '../../src/lib/profileStore';
import { notifySuccess, notifyError } from '../../src/lib/notify';

export default function ProfileScreen() {
  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user;

  const { displayName, homeName, ready, saveProfile } = useProfile();

  const [name, setName] = useState('');
  const [home, setHome] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (ready && !initialized) {
      setName(displayName || user?.name || '');
      setHome(homeName);
      setInitialized(true);
    }
  }, [ready, initialized, displayName, homeName, user?.name]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveProfile(name, home);
      setSaved(true);
      notifySuccess('Profile saved', 'Your changes are synced');
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError('Could not update profile. Please try again.');
      notifyError('Save failed', 'Could not update profile');
    } finally {
      setSaving(false);
    }
  };

  const initial = (name || user?.email || '?').charAt(0).toUpperCase();

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
            Edit Profile
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="items-center mt-2 mb-6">
            <View
              className="w-20 h-20 rounded-full items-center justify-center"
              style={{ backgroundColor: colors.surfaceAlt, borderWidth: 2, borderColor: colors.primary + '55' }}
            >
              <Text style={{ color: colors.primary, fontSize: 28, fontWeight: '800' }}>{initial}</Text>
            </View>
            <Text style={{ color: colors.textFaint, fontSize: 13, marginTop: 10 }}>
              {user?.email}
            </Text>
          </View>

          <View
            className="rounded-2xl p-5"
            style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
          >
            <Text style={{ color: colors.textFaint, fontSize: 12, marginBottom: 6 }}>Display name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={colors.textFaint}
              className="rounded-xl px-3 py-3"
              style={{
                backgroundColor: colors.surfaceAlt,
                color: colors.text,
                fontSize: 15,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            />

            <Text style={{ color: colors.textFaint, fontSize: 12, marginBottom: 6, marginTop: 16 }}>
              Home / property name
            </Text>
            <TextInput
              value={home}
              onChangeText={setHome}
              placeholder="e.g. Main Residence"
              placeholderTextColor={colors.textFaint}
              className="rounded-xl px-3 py-3"
              style={{
                backgroundColor: colors.surfaceAlt,
                color: colors.text,
                fontSize: 15,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            />
            <Text style={{ color: colors.textFaint, fontSize: 11, marginTop: 6 }}>
              Used to label this home configuration across your devices.
            </Text>
          </View>

          {error && (
            <Text style={{ color: colors.danger, fontSize: 13, marginTop: 12, textAlign: 'center' }}>
              {error}
            </Text>
          )}

          <Pressable
            onPress={save}
            disabled={saving}
            className="rounded-2xl py-4 items-center flex-row justify-center mt-6 active:opacity-80"
            style={{ backgroundColor: saved ? colors.online : colors.primary, opacity: saving ? 0.7 : 1 }}
          >
            {saving ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <>
                <Ionicons name={saved ? 'checkmark-circle' : 'save'} size={18} color={colors.bg} />
                <Text style={{ color: colors.bg, fontSize: 16, fontWeight: '800', marginLeft: 8 }}>
                  {saved ? 'Saved' : 'Save Profile'}
                </Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
