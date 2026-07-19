import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors } from '../../src/constants/theme';
import { useSession, signOutUser } from '../../lib/auth-client';
import { useSubscription } from '../../src/lib/subscription';
import { useDeviceAccess } from '../../src/lib/deviceAccess';

function Row({
  icon,
  label,
  sub,
  onPress,
  tint = colors.textMuted,
}: {
  icon: string;
  label: string;
  sub?: string;
  onPress?: () => void;
  tint?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center px-4 py-3.5 active:opacity-70"
      style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}
    >
      <View
        className="w-9 h-9 rounded-xl items-center justify-center mr-3"
        style={{ backgroundColor: colors.surfaceAlt }}
      >
        <Ionicons name={icon as any} size={18} color={tint} />
      </View>
      <View className="flex-1">
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>{label}</Text>
        {sub && <Text style={{ color: colors.textFaint, fontSize: 12, marginTop: 1 }}>{sub}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
    </Pressable>
  );
}

export default function AccountScreen() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const { isPremium } = useSubscription();
  const { isAdmin } = useDeviceAccess();

  const user = session?.user;
  const planLabel = isPremium ? 'Premium plan · unlimited' : 'Free plan · 3 sensors';

  const handleSignOut = async () => {
    await signOutUser();
    router.replace('/auth');
  };

  if (isPending) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={{ color: colors.text, fontSize: 26, fontWeight: '800', marginBottom: 16 }}>
          Account
        </Text>

        <View
          className="rounded-2xl p-5 flex-row items-center"
          style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
        >
          <View
            className="w-14 h-14 rounded-full items-center justify-center mr-3"
            style={{ backgroundColor: colors.surfaceAlt }}
          >
            <Ionicons name="person" size={26} color={colors.primary} />
          </View>
          <View className="flex-1">
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>
              {user?.name || user?.email?.split('@')[0] || 'Welcome back'}
            </Text>
            <Text style={{ color: colors.textFaint, fontSize: 13, marginTop: 2 }}>
              {user?.email || planLabel}
            </Text>
          </View>
          <Pressable
            onPress={() => router.push('/settings/profile')}
            className="w-9 h-9 rounded-xl items-center justify-center active:opacity-70"
            style={{ backgroundColor: colors.surfaceAlt }}
          >
            <Ionicons name="pencil" size={16} color={colors.primary} />
          </Pressable>
        </View>

        {!isPremium ? (
          <Pressable
            onPress={() => router.push('/settings/subscription')}
            className="rounded-2xl p-5 mt-4 active:opacity-90"
            style={{ backgroundColor: 'rgba(45,212,191,0.10)', borderWidth: 1, borderColor: colors.primary + '55' }}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <Ionicons name="diamond" size={18} color={colors.primary} />
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', marginLeft: 8 }}>
                  Upgrade to Premium
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.primary} />
            </View>
            <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 6, lineHeight: 18 }}>
              Advanced monitoring, unlimited history & smart alerts for $4.99/mo — or unlock free
              with an access code.
            </Text>
          </Pressable>
        ) : (
          <View
            className="rounded-2xl p-5 mt-4 flex-row items-center"
            style={{ backgroundColor: 'rgba(45,212,191,0.10)', borderWidth: 1, borderColor: colors.primary + '55' }}
          >
            <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
            <View className="ml-3 flex-1">
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
                Premium Active
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>
                All advanced features unlocked.
              </Text>
            </View>
          </View>
        )}

        <View
          className="rounded-2xl mt-4 overflow-hidden"
          style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
        >
          <Row
            icon="diamond-outline"
            label="Subscription"
            sub={isPremium ? 'Premium active' : 'Manage plan & access code'}
            tint={colors.primary}
            onPress={() => router.push('/settings/subscription')}
          />
          <Row
            icon="person-outline"
            label="Edit Profile"
            sub="Name & home configuration"
            onPress={() => router.push('/settings/profile')}
          />
          <Row
            icon="time-outline"
            label="Command History"
            sub="Past actions & terminal usage"
            tint={colors.primary}
            onPress={() => router.push('/settings/history')}
          />
          {isAdmin && (
            <Row
              icon="key-outline"
              label="Device Access"
              sub="Assign sensors to user accounts"
              tint={colors.warning}
              onPress={() => router.push('/settings/device-access')}
            />
          )}
          <Row
            icon="bar-chart-outline"
            label="Usage Analytics"
            sub="Feature demand & revenue modeling"
            tint={colors.accent}
            onPress={() => router.push('/settings/analytics')}
          />
          <Row
            icon="notifications-outline"
            label="Alert Preferences"
            sub="Leak, connectivity, battery & quiet hours"
            onPress={() => router.push('/settings/preferences')}
          />
          <Row
            icon="options-outline"
            label="App Preferences"
            sub="Notifications, units & display"
            onPress={() => router.push('/settings/preferences')}
          />
          <Row icon="cloud-outline" label="Cloud Sync" sub="Remote access across devices" />
          <Row icon="help-circle-outline" label="Help & Support" />
        </View>

        <Pressable
          onPress={handleSignOut}
          className="rounded-2xl mt-4 py-4 items-center flex-row justify-center active:opacity-80"
          style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
        >
          <Ionicons name="log-out-outline" size={18} color="#f87171" />
          <Text style={{ color: '#f87171', fontSize: 15, fontWeight: '600', marginLeft: 8 }}>
            Sign Out
          </Text>
        </Pressable>

        <Text style={{ color: colors.textFaint, fontSize: 12, textAlign: 'center', marginTop: 20 }}>
          BH Sensors · Ambient Command v1.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
