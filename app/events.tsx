import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { useSession } from '../lib/auth-client';
import { colors } from '../src/constants/theme';
import { useSensors } from '../src/lib/sensorStore';
import { useLiveData } from '../src/lib/useLiveData';
import { useSmartAlerts, alertCategoryMeta } from '../src/lib/alerts';
import { useAlertSession, trackAlerts, alertFirstSeen } from '../src/lib/alertSession';
import { formatRelativeTime } from '../src/lib/mockData';

// Incident & Event Timeline — a chronological feed merging:
//   (a) live smart alerts (active + acknowledged) from the alert session
//   (b) command/scene history from Convex (user-scoped queries)
// Sensor connectivity-loss and leak-state changes surface through (a) — the
// alert engine derives them from the live, device-access-filtered sensor set.
//
// DEVICE SCOPING: alerts derive from useSensors() (already filtered per
// account); command/scene history queries are per-user in Convex.

type EventKind = 'alert' | 'action';

interface TimelineEvent {
  id: string;
  ts: number;
  kind: EventKind;
  icon: string;
  color: string;
  bg: string;
  title: string;
  subtitle: string;
  badge?: { label: string; color: string };
}

type Filter = 'all' | 'alerts' | 'actions';

const levelColor: Record<string, { color: string; bg: string }> = {
  danger: { color: colors.danger, bg: 'rgba(248,113,113,0.12)' },
  warning: { color: colors.warning, bg: 'rgba(251,191,36,0.12)' },
  info: { color: colors.accent, bg: 'rgba(129,140,248,0.12)' },
};

function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayHeading(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  if (dayKey(ts) === dayKey(today.getTime())) return 'Today';
  if (dayKey(ts) === dayKey(yesterday.getTime())) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

type CommandDoc = { _id: string; command: string; success: boolean; createdAt: number };
type SceneDoc = { _id: string; name: string; icon?: string; lastTriggeredAt?: number };

function EventRow({ event, isLast }: { event: TimelineEvent; isLast: boolean }) {
  return (
    <View className="flex-row">
      {/* Rail: severity dot + connector */}
      <View style={{ width: 22, alignItems: 'center' }}>
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: event.color,
            marginTop: 22,
          }}
        />
        {!isLast && <View style={{ width: 1, flex: 1, backgroundColor: colors.border, marginTop: 4 }} />}
      </View>

      <View
        className="flex-1 rounded-2xl"
        style={{
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 14,
          marginLeft: 10,
          marginBottom: isLast ? 0 : 12,
        }}
      >
        <View className="flex-row items-start">
          <View
            className="w-9 h-9 rounded-xl items-center justify-center"
            style={{ backgroundColor: event.bg }}
          >
            <Ionicons name={event.icon as any} size={17} color={event.color} />
          </View>
          <View className="flex-1" style={{ marginLeft: 10 }}>
            <View className="flex-row items-center">
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700', flex: 1 }} numberOfLines={2}>
                {event.title}
              </Text>
              <Text style={{ color: colors.textFaint, fontSize: 11, fontWeight: '600', marginLeft: 8 }}>
                {formatRelativeTime(event.ts)}
              </Text>
            </View>
            <View className="flex-row items-center" style={{ marginTop: 3 }}>
              <Text style={{ color: colors.textFaint, fontSize: 12, flex: 1 }} numberOfLines={1}>
                {event.subtitle}
              </Text>
              {event.badge && (
                <View
                  className="px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: colors.surfaceAlt, marginLeft: 8 }}
                >
                  <Text style={{ color: event.badge.color, fontSize: 10, fontWeight: '700' }}>
                    {event.badge.label}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

export default function EventsScreen() {
  const router = useRouter();
  const { data: session } = useSession();
  const { sensors: stored, ready } = useSensors();
  const { liveSensors: sensors } = useLiveData(stored);
  const { alerts } = useSmartAlerts(sensors);
  const alertSession = useAlertSession();
  const [filter, setFilter] = useState<Filter>('all');

  const commands = useQuery(api.queries.listCommandHistory, session ? {} : 'skip') as
    | CommandDoc[]
    | undefined;
  const scenes = useQuery(api.queries.listScenes, session ? {} : 'skip') as
    | SceneDoc[]
    | undefined;

  // Stamp first-seen times so alert events carry real detection timestamps
  // even if the Alerts tab was never opened this session.
  useEffect(() => {
    trackAlerts(alerts);
  }, [alerts]);

  const events = useMemo<TimelineEvent[]>(() => {
    const out: TimelineEvent[] = [];

    // (a) Smart alerts — active and acknowledged, honoring notification prefs
    // (muted categories never reach this list; see useSmartAlerts).
    for (const a of alerts) {
      const meta = levelColor[a.level] ?? levelColor.info;
      const cat = alertCategoryMeta(a.category);
      const acked = alertSession.acknowledged.has(a.id);
      out.push({
        id: `alert-${a.id}`,
        ts: alertFirstSeen(a.id),
        kind: 'alert',
        icon: cat.icon,
        color: meta.color,
        bg: meta.bg,
        title: a.title,
        subtitle: `${cat.label} · ${a.location}`,
        badge: acked
          ? { label: 'ACKNOWLEDGED', color: colors.textMuted }
          : { label: 'ACTIVE', color: meta.color },
      });
    }

    // (b) Console command history (per-user, from Convex)
    for (const c of commands ?? []) {
      out.push({
        id: `cmd-${c._id}`,
        ts: c.createdAt,
        kind: 'action',
        icon: 'terminal',
        color: c.success ? colors.primary : colors.danger,
        bg: c.success ? 'rgba(45,212,191,0.12)' : 'rgba(248,113,113,0.12)',
        title: c.command,
        subtitle: `Console command · ${c.success ? 'succeeded' : 'failed'}`,
      });
    }

    // (c) Scene triggers (per-user, from Convex)
    for (const s of scenes ?? []) {
      if (!s.lastTriggeredAt) continue;
      out.push({
        id: `scene-${s._id}`,
        ts: s.lastTriggeredAt,
        kind: 'action',
        icon: s.icon ?? 'flash',
        color: colors.accent,
        bg: 'rgba(129,140,248,0.12)',
        title: `Scene triggered — ${s.name}`,
        subtitle: 'One-tap scene applied to your devices',
      });
    }

    return out.sort((a, b) => b.ts - a.ts);
  }, [alerts, alertSession.acknowledged, commands, scenes]);

  const filtered = useMemo(
    () =>
      events.filter((e) =>
        filter === 'all' ? true : filter === 'alerts' ? e.kind === 'alert' : e.kind === 'action',
      ),
    [events, filter],
  );

  // Group by day, preserving descending order.
  const groups = useMemo(() => {
    const map: { key: string; heading: string; items: TimelineEvent[] }[] = [];
    for (const e of filtered) {
      const key = dayKey(e.ts);
      const last = map[map.length - 1];
      if (last && last.key === key) last.items.push(e);
      else map.push({ key, heading: dayHeading(e.ts), items: [e] });
    }
    return map;
  }, [filtered]);

  const loading = !ready || (session && (commands === undefined || scenes === undefined));

  const filters: { key: Filter; label: string; icon: string }[] = [
    { key: 'all', label: 'All', icon: 'layers-outline' },
    { key: 'alerts', label: 'Alerts', icon: 'notifications-outline' },
    { key: 'actions', label: 'Actions', icon: 'flash-outline' },
  ];

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
        <View style={{ marginLeft: 12 }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>Event Timeline</Text>
          <Text style={{ color: colors.textFaint, fontSize: 12 }}>
            Incidents & actions across your fleet
          </Text>
        </View>
      </View>

      {/* Filter chips */}
      <View className="flex-row px-5" style={{ gap: 14, marginTop: 4, marginBottom: 8 }}>
        {filters.map((f) => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              className="flex-row items-center px-4 py-2 rounded-full active:opacity-80"
              style={{
                backgroundColor: active ? 'rgba(45,212,191,0.15)' : colors.surface,
                borderWidth: 1,
                borderColor: active ? colors.primary : colors.border,
              }}
            >
              <Ionicons name={f.icon as any} size={14} color={active ? colors.primary : colors.textMuted} />
              <Text
                style={{
                  color: active ? colors.primary : colors.textMuted,
                  fontSize: 13,
                  fontWeight: '700',
                  marginLeft: 6,
                }}
              >
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingTop: 8, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {groups.length === 0 ? (
            <View
              className="rounded-2xl items-center"
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                paddingVertical: 48,
                paddingHorizontal: 24,
                marginTop: 12,
              }}
            >
              <View
                className="items-center justify-center"
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: 'rgba(129,140,248,0.10)',
                  borderWidth: 1,
                  borderColor: 'rgba(129,140,248,0.30)',
                }}
              >
                <Ionicons name="time-outline" size={38} color={colors.accent} />
              </View>
              <Text style={{ color: colors.text, fontSize: 17, fontWeight: '800', marginTop: 16 }}>
                No events yet
              </Text>
              <Text
                style={{ color: colors.textMuted, fontSize: 13, marginTop: 8, textAlign: 'center', lineHeight: 19 }}
              >
                {filter === 'alerts'
                  ? 'No alert incidents recorded this session. New detections will appear here instantly.'
                  : filter === 'actions'
                    ? 'No commands or scenes have been run yet. Actions you take will be logged here.'
                    : 'Alerts, commands and scene runs will appear here as they happen across your assigned sensors.'}
              </Text>
            </View>
          ) : (
            groups.map((g) => (
              <View key={g.key} style={{ marginBottom: 20 }}>
                {/* Day header */}
                <View className="flex-row items-center" style={{ marginBottom: 12 }}>
                  <View
                    className="px-3 py-1 rounded-full"
                    style={{ backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border }}
                  >
                    <Text
                      style={{
                        color: colors.textMuted,
                        fontSize: 11,
                        fontWeight: '800',
                        letterSpacing: 0.8,
                        textTransform: 'uppercase',
                      }}
                    >
                      {g.heading}
                    </Text>
                  </View>
                  <View style={{ flex: 1, height: 1, backgroundColor: colors.border, marginLeft: 12 }} />
                  <Text style={{ color: colors.textFaint, fontSize: 11, marginLeft: 10 }}>
                    {g.items.length} {g.items.length === 1 ? 'event' : 'events'}
                  </Text>
                </View>
                {g.items.map((e, i) => (
                  <EventRow key={e.id} event={e} isLast={i === g.items.length - 1} />
                ))}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
