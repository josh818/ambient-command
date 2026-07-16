import { useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/constants/theme';
import { useDiagnostics, type CheckState } from '../../src/lib/diagnostics';
import { useConnectivity } from '../../src/lib/useConnectivity';
import { useSensors } from '../../src/lib/sensorStore';
import { useSmartAlerts } from '../../src/lib/alerts';
import { useSubscription } from '../../src/lib/subscription';
import { useSession } from '../../lib/auth-client';
import { useStateLogger, type AppStateSnapshot } from '../../src/lib/stateLogger';

const stateMeta: Record<CheckState, { icon: string; color: string }> = {
  pending: { icon: 'ellipse-outline', color: colors.textFaint },
  running: { icon: 'sync', color: colors.warning },
  pass: { icon: 'checkmark-circle', color: colors.online },
  fail: { icon: 'close-circle', color: colors.danger },
};

function StateRow({ label, value, tint }: { label: string; value: string; tint?: string }) {
  return (
    <View
      className="flex-row items-center justify-between py-2"
      style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}
    >
      <Text style={{ color: colors.textMuted, fontSize: 13 }}>{label}</Text>
      <Text style={{ color: tint ?? colors.text, fontSize: 13, fontWeight: '700' }}>{value}</Text>
    </View>
  );
}

export default function DiagnosticsScreen() {
  const { steps, suiteState, run, endpoint, startedAt, finishedAt } = useDiagnostics();
  const running = suiteState === 'running';

  // Live internal state aggregation for the debug panel.
  const { data: session } = useSession();
  const { status: apiStatus, rawDataCount } = useConnectivity();
  const { sensors } = useSensors();
  const { counts } = useSmartAlerts(sensors);
  const { tier, isPremium } = useSubscription();

  const { snapshot, log } = useStateLogger({
    authenticated: !!session,
    userId: session?.user?.id ?? null,
    email: session?.user?.email ?? null,
    apiStatus,
    rawDataCount,
    sensors,
    alertCounts: {
      critical: counts.critical,
      warning: counts.warnings,
      info: counts.info,
      total: counts.total,
    },
    tier,
    isPremium,
  });

  const [logged, setLogged] = useState<AppStateSnapshot | null>(null);

  const handleLog = () => {
    const snap = log();
    setLogged(snap);
  };

  const summaryColor =
    suiteState === 'pass'
      ? colors.online
      : suiteState === 'fail'
        ? colors.danger
        : colors.textMuted;
  const summaryLabel =
    suiteState === 'idle'
      ? 'Not run yet'
      : suiteState === 'running'
        ? 'Running checks…'
        : suiteState === 'pass'
          ? 'All checks passed'
          : 'Some checks failed';

  const elapsed = startedAt && finishedAt ? finishedAt - startedAt : null;

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.bg }} edges={['top']}>
      <View className="px-5 pt-2 pb-1">
        <Text style={{ color: colors.text, fontSize: 26, fontWeight: '800' }}>Diagnostics</Text>
        <Text style={{ color: colors.textFaint, fontSize: 13, marginTop: 2 }}>
          Verify server & database connectivity
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary card */}
        <View
          className="rounded-2xl p-5 items-center"
          style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
        >
          <View
            className="w-14 h-14 rounded-2xl items-center justify-center mb-3"
            style={{ backgroundColor: summaryColor + '22' }}
          >
            {running ? (
              <ActivityIndicator color={summaryColor} />
            ) : (
              <Ionicons
                name={
                  suiteState === 'pass'
                    ? 'shield-checkmark'
                    : suiteState === 'fail'
                      ? 'warning'
                      : 'pulse'
                }
                size={28}
                color={summaryColor}
              />
            )}
          </View>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>{summaryLabel}</Text>
          <Text style={{ color: colors.textFaint, fontSize: 12, marginTop: 4 }} numberOfLines={1}>
            {endpoint.replace('https://', '').replace('http://', '')}
          </Text>
          {elapsed !== null && (
            <Text style={{ color: colors.textFaint, fontSize: 12, marginTop: 2 }}>
              Completed in {elapsed}ms
            </Text>
          )}
        </View>

        {/* Steps */}
        <View className="mt-5">
          {steps.map((step) => {
            const meta = stateMeta[step.state];
            return (
              <View
                key={step.id}
                className="rounded-2xl p-4 mb-3 flex-row items-start"
                style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
              >
                <View
                  className="w-9 h-9 rounded-xl items-center justify-center mr-3"
                  style={{ backgroundColor: meta.color + '22' }}
                >
                  {step.state === 'running' ? (
                    <ActivityIndicator size="small" color={meta.color} />
                  ) : (
                    <Ionicons name={meta.icon as any} size={18} color={meta.color} />
                  )}
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center justify-between">
                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>
                      {step.label}
                    </Text>
                    {step.latencyMs !== null && (
                      <Text style={{ color: colors.textFaint, fontSize: 11, fontWeight: '600' }}>
                        {step.latencyMs}ms
                      </Text>
                    )}
                  </View>
                  <Text style={{ color: colors.textFaint, fontSize: 12, marginTop: 2 }}>
                    {step.description}
                  </Text>
                  {step.detail && (
                    <Text
                      style={{
                        color:
                          step.state === 'fail'
                            ? colors.danger
                            : step.state === 'pass'
                              ? colors.online
                              : colors.textMuted,
                        fontSize: 12,
                        fontWeight: '600',
                        marginTop: 6,
                      }}
                    >
                      {step.detail}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* Run button */}
        <Pressable
          onPress={() => void run()}
          disabled={running}
          className="rounded-2xl py-4 items-center mt-2 active:opacity-80 flex-row justify-center"
          style={{ backgroundColor: running ? colors.surfaceAlt : colors.primary }}
        >
          {running ? (
            <ActivityIndicator color={colors.bg} />
          ) : (
            <>
              <Ionicons name="play" size={18} color={colors.bg} />
              <Text style={{ color: colors.bg, fontSize: 16, fontWeight: '800', marginLeft: 8 }}>
                {suiteState === 'idle' ? 'Run Diagnostics' : 'Run Again'}
              </Text>
            </>
          )}
        </Pressable>

        {/* Debug state panel */}
        <View className="flex-row items-center mt-8 mb-3">
          <Ionicons name="bug-outline" size={16} color={colors.accent} />
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800', marginLeft: 8 }}>
            Application State
          </Text>
        </View>

        <View
          className="rounded-2xl p-4"
          style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
        >
          <StateRow
            label="Session"
            value={snapshot.session.authenticated ? 'Authenticated' : 'Guest'}
            tint={snapshot.session.authenticated ? colors.online : colors.textMuted}
          />
          {snapshot.session.email && <StateRow label="User" value={snapshot.session.email} />}
          <StateRow
            label="API"
            value={snapshot.api.status}
            tint={snapshot.api.status === 'online' ? colors.online : colors.warning}
          />
          <StateRow
            label="DB records"
            value={snapshot.api.rawDataCount?.toLocaleString() ?? '—'}
          />
          <StateRow label="Sensors total" value={`${snapshot.sensors.total}`} />
          <StateRow label="Online" value={`${snapshot.sensors.online}`} tint={colors.online} />
          <StateRow label="Warning" value={`${snapshot.sensors.warning}`} tint={colors.warning} />
          <StateRow label="Offline" value={`${snapshot.sensors.offline}`} tint={colors.offline} />
          <StateRow label="Powered on" value={`${snapshot.sensors.poweredOn}`} />
          <StateRow
            label="Active alerts"
            value={`${snapshot.alerts.total}`}
            tint={snapshot.alerts.critical > 0 ? colors.danger : colors.text}
          />
          <View
            className="flex-row items-center justify-between pt-2"
          >
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>Plan</Text>
            <Text
              style={{
                color: snapshot.subscription.isPremium ? colors.primary : colors.textMuted,
                fontSize: 13,
                fontWeight: '700',
              }}
            >
              {snapshot.subscription.tier.toUpperCase()}
            </Text>
          </View>
        </View>

        <Pressable
          onPress={handleLog}
          className="rounded-2xl py-3.5 items-center mt-3 active:opacity-80 flex-row justify-center"
          style={{ backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border }}
        >
          <Ionicons name="terminal-outline" size={16} color={colors.accent} />
          <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '700', marginLeft: 8 }}>
            Log State to Console
          </Text>
        </Pressable>

        {logged && (
          <Text style={{ color: colors.online, fontSize: 11, textAlign: 'center', marginTop: 8 }}>
            Snapshot logged at {new Date(logged.capturedAt).toLocaleTimeString()} — check Metro
            logs
          </Text>
        )}

        <Text style={{ color: colors.textFaint, fontSize: 11, textAlign: 'center', marginTop: 14 }}>
          Runs a service compute check and reads the live database record count.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
