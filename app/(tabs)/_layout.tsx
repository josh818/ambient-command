import { Platform, View, ActivityIndicator } from 'react-native';
import { Tabs, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../src/constants/theme';
import { useSession } from '../../lib/auth-client';
import { GlobalStatusBar } from '../../src/components/GlobalStatusBar';

export default function TabLayout() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/auth" />;
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.bg }} edges={['top']}>
      <GlobalStatusBar />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textFaint,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            height: Platform.select({ web: 88, default: 96 }),
            paddingBottom: Platform.select({ web: 24, default: 32 }),
            paddingTop: 10,
          },
          tabBarLabelStyle: { fontSize: 11, marginTop: 4, fontWeight: '600' },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="pulse" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="sensors"
          options={{
            title: 'Sensors',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="hardware-chip" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="console"
          options={{
            title: 'Console',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="terminal" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="alerts"
          options={{
            title: 'Alerts',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="notifications" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="diagnostics"
          options={{
            title: 'Diagnostics',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="pulse-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="account"
          options={{
            title: 'Account',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person-circle" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen name="dashboard" options={{ href: null }} />
      </Tabs>
    </SafeAreaView>
  );
}
