import { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery, useMutation } from 'convex/react';
import { colors, fonts } from '../../src/constants/theme';
import { api } from '../../convex/_generated/api';
import { useDeviceAccess } from '../../src/lib/deviceAccess';
import { mockSensors } from '../../src/lib/mockData';
import { useLiveRoster } from '../../src/lib/liveRoster';
import { notifySuccess, notifyError } from '../../src/lib/notify';

// Admin-only screen: assign fleet modules to user accounts by email.
// Reachable from the Account tab (row is only shown to admins); non-admins
// who deep-link here get a locked state — the server enforces access anyway.

type Assignment = {
  _id: string;
  userEmail: string;
  moduleId: string;
  label?: string;
  assignedAt: number;
  assignedBy: string;
};

function SectionLabel({ children }: { children: string }) {
  return (
    <Text
      style={{
        color: colors.textFaint,
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.5,
        marginBottom: 8,
        marginTop: 20,
        textTransform: 'uppercase',
      }}
    >
      {children}
    </Text>
  );
}

function ModuleRow({
  id,
  name,
  location,
  assignedCount,
  onAssign,
  busy,
}: {
  id: string;
  name: string;
  location: string;
  assignedCount: number;
  onAssign: (email: string) => Promise<void>;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');

  const submit = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    await onAssign(trimmed);
    setEmail('');
    setOpen(false);
  };

  return (
    <View
      className="rounded-2xl"
      style={{
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 20,
      }}
    >
      <View className="flex-row items-center">
        <View
          className="w-10 h-10 rounded-xl items-center justify-center mr-3"
          style={{ backgroundColor: colors.surfaceAlt }}
        >
          <Ionicons name="hardware-chip-outline" size={19} color={colors.primary} />
        </View>
        <View className="flex-1 mr-2">
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>{name}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 1 }}>{location}</Text>
          <Text
            style={{ color: colors.textFaint, fontSize: 11, marginTop: 2, fontFamily: fonts.mono }}
          >
            ID {id}
          </Text>
          <Text style={{ color: colors.textFaint, fontSize: 11, marginTop: 2 }}>
            {assignedCount === 0
              ? 'Not assigned to any account'
              : `Assigned to ${assignedCount} ${assignedCount === 1 ? 'account' : 'accounts'}`}
          </Text>
        </View>
        <Pressable
          onPress={() => setOpen((v) => !v)}
          className="px-4 rounded-xl items-center justify-center active:opacity-80"
          style={{
            height: 40,
            backgroundColor: open ? colors.surfaceAlt : colors.primary,
            borderWidth: 1,
            borderColor: open ? colors.border : colors.primary,
          }}
        >
          <Text
            style={{
              color: open ? colors.textMuted : colors.bg,
              fontSize: 13,
              fontWeight: '700',
            }}
          >
            {open ? 'Cancel' : 'Assign'}
          </Text>
        </Pressable>
      </View>

      {open && (
        <View style={{ marginTop: 16, gap: 16 }}>
          <TextInput
            value={email}
            onChangeText={setEmail}
            onSubmitEditing={() => void submit()}
            placeholder="user@example.com"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            className="px-4 rounded-xl"
            style={{
              height: 56,
              backgroundColor: colors.surfaceAlt,
              borderWidth: 1,
              borderColor: colors.border,
              color: colors.text,
              fontSize: 15,
            }}
          />
          <Pressable
            onPress={() => void submit()}
            disabled={busy || !email.trim()}
            className="rounded-xl items-center justify-center flex-row active:opacity-80"
            style={{
              height: 56,
              backgroundColor: email.trim() ? colors.primary : colors.surfaceAlt,
              borderWidth: 1,
              borderColor: email.trim() ? colors.primary : colors.border,
            }}
          >
            {busy ? (
              <ActivityIndicator size="small" color={colors.bg} />
            ) : (
              <>
                <Ionicons
                  name="person-add-outline"
                  size={17}
                  color={email.trim() ? colors.bg : colors.textFaint}
                />
                <Text
                  style={{
                    color: email.trim() ? colors.bg : colors.textFaint,
                    fontSize: 15,
                    fontWeight: '700',
                    marginLeft: 8,
                  }}
                >
                  Assign to this account
                </Text>
              </>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
}

export default function DeviceAccessScreen() {
  const router = useRouter();
  const access = useDeviceAccess();
  const assignments = useQuery(
    api.access.listAllAssignments,
    access.isAdmin ? {} : 'skip',
  ) as Assignment[] | undefined;
  const assignDevice = useMutation(api.access.assignDevice);
  const unassignDevice = useMutation(api.access.unassignDevice);
  const [busyModuleId, setBusyModuleId] = useState<string | null>(null);

  const roster = useLiveRoster();

  // Static snapshot UNION live server roster, so newly provisioned modules
  // are assignable without an app update.
  const fleet = useMemo(() => {
    const byId = new Map(mockSensors.map((s) => [s.id, { id: s.id, name: s.defaultName, location: s.location }]));
    for (const e of roster.entries ?? []) {
      const existing = byId.get(e.id);
      if (existing) {
        if (e.unitName) existing.name = e.unitName;
        if (e.locationName) existing.location = e.locationName;
      } else {
        byId.set(e.id, { id: e.id, name: e.unitName || `Device ${e.id.slice(-4)}`, location: e.locationName });
      }
    }
    return [...byId.values()];
  }, [roster.entries]);

  const moduleName = useMemo(() => {
    const map = new Map<string, string>();
    fleet.forEach((s) => map.set(s.id, s.name));
    return map;
  }, [fleet]);

  const assignedCounts = useMemo(() => {
    const counts = new Map<string, number>();
    (assignments ?? []).forEach((a) => {
      counts.set(a.moduleId, (counts.get(a.moduleId) ?? 0) + 1);
    });
    return counts;
  }, [assignments]);

  const grouped = useMemo(() => {
    const byEmail = new Map<string, Assignment[]>();
    (assignments ?? []).forEach((a) => {
      const list = byEmail.get(a.userEmail) ?? [];
      list.push(a);
      byEmail.set(a.userEmail, list);
    });
    return [...byEmail.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [assignments]);

  const handleAssign = async (moduleId: string, email: string) => {
    setBusyModuleId(moduleId);
    try {
      await assignDevice({ userEmail: email, moduleId });
      notifySuccess('Device assigned', `${moduleName.get(moduleId) ?? moduleId} → ${email.trim().toLowerCase()}`);
    } catch (e) {
      notifyError('Assign failed', e instanceof Error ? e.message : 'Please try again');
    } finally {
      setBusyModuleId(null);
    }
  };

  const handleUnassign = async (a: Assignment) => {
    try {
      await unassignDevice({ userEmail: a.userEmail, moduleId: a.moduleId });
      notifySuccess('Assignment removed', `${moduleName.get(a.moduleId) ?? a.moduleId} from ${a.userEmail}`);
    } catch (e) {
      notifyError('Remove failed', e instanceof Error ? e.message : 'Please try again');
    }
  };

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
          Device Access
        </Text>
      </View>

      {access.loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : !access.isAdmin ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="lock-closed-outline" size={36} color={colors.textFaint} />
          <Text
            style={{
              color: colors.text,
              fontSize: 16,
              fontWeight: '700',
              marginTop: 16,
              textAlign: 'center',
            }}
          >
            Administrators only
          </Text>
          <Text
            style={{
              color: colors.textMuted,
              fontSize: 13,
              marginTop: 6,
              textAlign: 'center',
              lineHeight: 19,
            }}
          >
            Device assignment is managed by your fleet administrator.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 19 }}>
            Assign fleet modules to user accounts by email. Users only see the
            devices assigned to their address; admins always see the full fleet.
          </Text>

          <SectionLabel>Fleet Roster</SectionLabel>
          <View style={{ gap: 16 }}>
            {fleet.map((s) => (
              <ModuleRow
                key={s.id}
                id={s.id}
                name={s.name}
                location={s.location}
                assignedCount={assignedCounts.get(s.id) ?? 0}
                busy={busyModuleId === s.id}
                onAssign={(email) => handleAssign(s.id, email)}
              />
            ))}
          </View>

          <SectionLabel>Current Assignments</SectionLabel>
          {assignments === undefined ? (
            <View
              className="rounded-2xl items-center"
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                padding: 20,
              }}
            >
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : grouped.length === 0 ? (
            <View
              className="rounded-2xl items-center"
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                padding: 20,
              }}
            >
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                No assignments yet — assign a module above.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 16 }}>
              {grouped.map(([email, rows]) => (
                <View
                  key={email}
                  className="rounded-2xl"
                  style={{
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    padding: 20,
                  }}
                >
                  <View className="flex-row items-center mb-3">
                    <Ionicons name="person-circle-outline" size={18} color={colors.accent} />
                    <Text
                      style={{
                        color: colors.text,
                        fontSize: 14,
                        fontWeight: '700',
                        marginLeft: 8,
                        flex: 1,
                      }}
                      numberOfLines={1}
                    >
                      {email}
                    </Text>
                    <Text style={{ color: colors.textFaint, fontSize: 12 }}>
                      {rows.length} {rows.length === 1 ? 'device' : 'devices'}
                    </Text>
                  </View>
                  <View style={{ gap: 8 }}>
                    {rows.map((a) => (
                      <View
                        key={a._id}
                        className="flex-row items-center rounded-xl px-3 py-2.5"
                        style={{ backgroundColor: colors.surfaceAlt }}
                      >
                        <Ionicons name="water-outline" size={15} color={colors.primary} />
                        <View className="flex-1 ml-2.5 mr-2">
                          <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>
                            {a.label ?? moduleName.get(a.moduleId) ?? 'Module'}
                          </Text>
                          <Text
                            style={{
                              color: colors.textFaint,
                              fontSize: 11,
                              fontFamily: fonts.mono,
                              marginTop: 1,
                            }}
                          >
                            {a.moduleId}
                          </Text>
                        </View>
                        <Pressable
                          onPress={() => void handleUnassign(a)}
                          className="w-9 h-9 rounded-lg items-center justify-center active:opacity-70"
                          style={{ backgroundColor: 'rgba(224,114,89,0.12)' }}
                        >
                          <Ionicons name="trash-outline" size={16} color={colors.danger} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
