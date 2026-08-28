import { useMemo } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useSession } from '../../lib/auth-client';
import { colors, fonts } from '../../src/constants/theme';
import { formatRelativeTime } from '../../src/lib/mockData';

const MONO = fonts.mono;

type CommandDoc = {
  _id: string;
  command: string;
  success: boolean;
  createdAt: number;
};

function StatCard({
  label,
  value,
  icon,
  tint,
}: {
  label: string;
  value: string;
  icon: string;
  tint: string;
}) {
  return (
    <View
      className="flex-1 rounded-2xl p-4"
      style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
    >
      <View
        className="w-8 h-8 rounded-lg items-center justify-center mb-2"
        style={{ backgroundColor: colors.surfaceAlt }}
      >
        <Ionicons name={icon as any} size={16} color={tint} />
      </View>
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: colors.textFaint, fontSize: 12, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

export default function HistoryScreen() {
  const router = useRouter();
  const { data: session } = useSession();
  const history = useQuery(
    api.queries.listCommandHistory,
    session ? {} : 'skip',
  ) as CommandDoc[] | undefined;

  const stats = useMemo(() => {
    const list = history ?? [];
    const total = list.length;
    const success = list.filter((h) => h.success).length;
    const failed = total - success;
    const successRate = total > 0 ? Math.round((success / total) * 100) : 0;

    const counts = new Map<string, number>();
    list.forEach((h) => {
      const base = h.command.trim().split(/\s+/)[0].toLowerCase();
      counts.set(base, (counts.get(base) ?? 0) + 1);
    });
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

    return { total, success, failed, successRate, top };
  }, [history]);

  const loading = session && history === undefined;

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.bg }} edges={['top']}>
      <View className="flex-row items-center px-5 py-3">
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full items-center justify-center active:opacity-70"
          style={{ backgroundColor: colors.surface }}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginLeft: 12 }}>
          Command History
        </Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Stats row */}
          <View className="flex-row" style={{ gap: 12 }}>
            <StatCard label="Total run" value={String(stats.total)} icon="terminal" tint={colors.primary} />
            <StatCard
              label="Success rate"
              value={`${stats.successRate}%`}
              icon="checkmark-circle"
              tint={colors.online}
            />
            <StatCard label="Failed" value={String(stats.failed)} icon="alert-circle" tint={colors.danger} />
          </View>

          {/* Top commands */}
          {stats.top.length > 0 && (
            <>
              <Text
                style={{
                  color: colors.textFaint,
                  fontSize: 12,
                  fontWeight: '700',
                  letterSpacing: 0.5,
                  marginTop: 24,
                  marginBottom: 8,
                  textTransform: 'uppercase',
                }}
              >
                Most Used Commands
              </Text>
              <View
                className="rounded-2xl p-4"
                style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
              >
                {stats.top.map(([cmd, count], i) => {
                  const max = stats.top[0][1] || 1;
                  const pct = Math.round((count / max) * 100);
                  return (
                    <View key={cmd} style={{ marginBottom: i === stats.top.length - 1 ? 0 : 12 }}>
                      <View className="flex-row items-center justify-between mb-1.5">
                        <Text style={{ color: colors.primary, fontSize: 13, fontFamily: MONO, fontWeight: '700' }}>
                          {cmd}
                        </Text>
                        <Text style={{ color: colors.textMuted, fontSize: 12 }}>{count}×</Text>
                      </View>
                      <View
                        className="h-1.5 rounded-full overflow-hidden"
                        style={{ backgroundColor: colors.surfaceAlt }}
                      >
                        <View
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: colors.primary }}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            </>
          )}

          {/* Recent log */}
          <Text
            style={{
              color: colors.textFaint,
              fontSize: 12,
              fontWeight: '700',
              letterSpacing: 0.5,
              marginTop: 24,
              marginBottom: 8,
              textTransform: 'uppercase',
            }}
          >
            Recent Activity
          </Text>

          {(history ?? []).length === 0 ? (
            <View
              className="rounded-2xl p-8 items-center"
              style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
            >
              <Ionicons name="terminal-outline" size={32} color={colors.textFaint} />
              <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 10, textAlign: 'center' }}>
                No commands yet. Open the Console and run a command to see your history here.
              </Text>
            </View>
          ) : (
            <View
              className="rounded-2xl overflow-hidden"
              style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
            >
              {(history ?? []).map((h, i) => (
                <View
                  key={h._id}
                  className="flex-row items-center px-4 py-3"
                  style={
                    i === (history ?? []).length - 1
                      ? undefined
                      : { borderBottomWidth: 1, borderBottomColor: colors.border }
                  }
                >
                  <Ionicons
                    name={h.success ? 'checkmark-circle' : 'close-circle'}
                    size={16}
                    color={h.success ? colors.online : colors.danger}
                  />
                  <Text
                    style={{
                      color: colors.text,
                      fontSize: 13.5,
                      fontFamily: MONO,
                      marginLeft: 10,
                      flex: 1,
                    }}
                    numberOfLines={1}
                  >
                    {h.command}
                  </Text>
                  <Text style={{ color: colors.textFaint, fontSize: 11, marginLeft: 8 }}>
                    {formatRelativeTime(h.createdAt)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <Pressable
            onPress={() => router.push('/(tabs)/console')}
            className="rounded-2xl mt-6 py-4 items-center flex-row justify-center active:opacity-80"
            style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary + '55' }}
          >
            <Ionicons name="terminal" size={18} color={colors.primary} />
            <Text style={{ color: colors.primary, fontSize: 15, fontWeight: '700', marginLeft: 8 }}>
              Open Console
            </Text>
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
