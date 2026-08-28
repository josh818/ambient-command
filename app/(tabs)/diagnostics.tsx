import { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/constants/theme';
import {
  useSystemCheck,
  type SystemCheckStep,
  type SystemGrade,
} from '../../src/lib/diagnostics';
import { useConnectivity } from '../../src/lib/useConnectivity';
import { useSensors } from '../../src/lib/sensorStore';
import { useLiveData } from '../../src/lib/useLiveData';
import { useSmartAlerts } from '../../src/lib/alerts';
import { useSubscription } from '../../src/lib/subscription';
import { useSession } from '../../lib/auth-client';
import { useStateLogger, type AppStateSnapshot } from '../../src/lib/stateLogger';
import { hapticSuccess, hapticWarning } from '../../src/lib/haptics';

const stepIcons: Record<string, string> = {
  connectivity: 'globe-outline',
  mesh: 'git-network-outline',
  battery: 'battery-charging-outline',
  firmware: 'hardware-chip-outline',
  cloud: 'cloud-done-outline',
};

const gradeMeta: Record<SystemGrade, { color: string; caption: string }> = {
  'A+': { color: colors.online, caption: 'Mission ready — everything checks out' },
  A: { color: colors.primary, caption: 'Healthy — minor items worth a glance' },
  B: { color: colors.warning, caption: 'Degraded — one system needs attention' },
  C: { color: colors.danger, caption: 'Action required — critical issues found' },
};

function CheckRow({ step, index }: { step: SystemCheckStep; index: number }) {
  const enter = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;
  const settled = step.state === 'pass' || step.state === 'fail';

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 320,
      delay: index * 80,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enter, index]);

  useEffect(() => {
    if (settled) {
      pop.setValue(0);
      Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 24, bounciness: 12 }).start();
    }
  }, [settled, pop]);

  const tint =
    step.state === 'pass'
      ? colors.online
      : step.state === 'fail'
        ? colors.danger
        : step.state === 'running'
          ? colors.primary
          : colors.textFaint;

  return (
    <Animated.View
      style={{
        opacity: enter,
        transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
        marginBottom: 12,
      }}
    >
      <View
        className="rounded-2xl p-4 flex-row items-center"
        style={{
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: step.state === 'running' ? colors.primary + '55' : colors.border,
          opacity: step.state === 'pending' ? 0.55 : 1,
        }}
      >
        <View
          className="w-10 h-10 rounded-xl items-center justify-center mr-3"
          style={{ backgroundColor: tint + '18' }}
        >
          <Ionicons name={stepIcons[step.id] as any} size={19} color={tint} />
        </View>
        <View className="flex-1" style={{ paddingRight: 10 }}>
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>{step.label}</Text>
          <Text style={{ color: colors.textFaint, fontSize: 12, marginTop: 2 }}>
            {step.detail ?? step.description}
          </Text>
        </View>
        <View style={{ width: 26, alignItems: 'center' }}>
          {step.state === 'running' ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : settled ? (
            <Animated.View style={{ transform: [{ scale: pop }] }}>
              <Ionicons
                name={step.state === 'pass' ? 'checkmark-circle' : 'close-circle'}
                size={24}
                color={tint}
              />
            </Animated.View>
          ) : (
            <Ionicons name="ellipse-outline" size={18} color={colors.textFaint} />
          )}
        </View>
      </View>
    </Animated.View>
  );
}

function GradeBadge({ grade }: { grade: SystemGrade }) {
  const scale = useRef(new Animated.Value(0)).current;
  const meta = gradeMeta[grade];

  useEffect(() => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 10 }).start();
  }, [scale]);

  return (
    <View className="items-center" style={{ marginTop: 24 }}>
      <Animated.View
        style={{
          transform: [{ scale }],
          width: 96,
          height: 96,
          borderRadius: 48,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: meta.color + '14',
          borderWidth: 2,
          borderColor: meta.color,
          // subtle glow
          shadowColor: meta.color,
          shadowOpacity: 0.55,
          shadowRadius: 22,
          shadowOffset: { width: 0, height: 0 },
          elevation: 10,
        }}
      >
        <Text style={{ color: meta.color, fontSize: 36, fontWeight: '800' }}>{grade}</Text>
      </Animated.View>
      <Text style={{ color: colors.textFaint, fontSize: 11, fontWeight: '700', letterSpacing: 1.4, marginTop: 14 }}>
        SYSTEM GRADE
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4, textAlign: 'center' }}>
        {meta.caption}
      </Text>
    </View>
  );
}

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
  const { steps, phase, progress, grade, run, endpoint, startedAt, finishedAt } = useSystemCheck();
  const running = phase === 'running';
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Live internal state aggregation for the debug panel + check inputs.
  const { data: session } = useSession();
  const { status: apiStatus, rawDataCount } = useConnectivity();
  const { sensors: stored } = useSensors();
  const { liveSensors: sensors } = useLiveData(stored);
  const { counts } = useSmartAlerts(sensors);
  const { tier, isPremium } = useSubscription();

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // animates width
    }).start();
  }, [progress, progressAnim]);

  // Haptic punctuation when the sweep lands (native only).
  useEffect(() => {
    if (phase === 'done' && grade) {
      if (grade === 'A+' || grade === 'A') void hapticSuccess();
      else void hapticWarning();
    }
  }, [phase, grade]);

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

  const handleRun = () => {
    void run({
      sensors,
      criticalAlerts: counts.critical,
      warningAlerts: counts.warnings,
    });
  };

  const elapsed = startedAt && finishedAt ? finishedAt - startedAt : null;
  const doneCount = steps.filter((s) => s.state === 'pass' || s.state === 'fail').length;

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.bg }} edges={['top']}>
      <View className="px-5 pt-2 pb-1">
        <Text style={{ color: colors.text, fontSize: 26, fontWeight: '800' }}>Diagnostics</Text>
        <Text style={{ color: colors.textFaint, fontSize: 13, marginTop: 2 }}>
          Full-fleet system check · server, mesh, batteries & cloud
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Run button */}
        <Pressable
          onPress={handleRun}
          disabled={running}
          className="rounded-2xl py-4 items-center active:opacity-80 flex-row justify-center"
          style={{ backgroundColor: running ? colors.surfaceAlt : colors.primary }}
          accessibilityRole="button"
        >
          {running ? (
            <>
              <ActivityIndicator color={colors.primary} />
              <Text style={{ color: colors.textMuted, fontSize: 16, fontWeight: '800', marginLeft: 10 }}>
                Sweeping systems… {doneCount}/{steps.length}
              </Text>
            </>
          ) : (
            <>
              <Ionicons name="play" size={18} color={colors.bg} />
              <Text style={{ color: colors.bg, fontSize: 16, fontWeight: '800', marginLeft: 8 }}>
                {phase === 'idle' ? 'Run Diagnostics' : 'Run Again'}
              </Text>
            </>
          )}
        </Pressable>

        {/* Progress line */}
        <View
          style={{
            height: 4,
            borderRadius: 2,
            backgroundColor: colors.surfaceAlt,
            marginTop: 16,
            overflow: 'hidden',
          }}
        >
          <Animated.View
            style={{
              height: 4,
              borderRadius: 2,
              backgroundColor:
                phase === 'done' && grade ? gradeMeta[grade].color : colors.primary,
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            }}
          />
        </View>

        {/* Check rows (staggered) */}
        <View style={{ marginTop: 20 }}>
          {phase === 'idle' ? (
            <View
              className="rounded-2xl items-center"
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                paddingVertical: 40,
                paddingHorizontal: 24,
              }}
            >
              <View
                className="items-center justify-center"
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: 'rgba(126,226,190,0.10)',
                }}
              >
                <Ionicons name="pulse" size={30} color={colors.primary} />
              </View>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', marginTop: 14 }}>
                Ready for a system sweep
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
                Checks connectivity, the sensor mesh, battery fleet, firmware and cloud sync —
                then grades the whole system.
              </Text>
            </View>
          ) : (
            steps.map((step, i) => <CheckRow key={`${startedAt}-${step.id}`} step={step} index={i} />)
          )}
        </View>

        {/* Grade */}
        {phase === 'done' && grade && (
          <>
            <GradeBadge grade={grade} />
            {elapsed !== null && (
              <Text style={{ color: colors.textFaint, fontSize: 12, textAlign: 'center', marginTop: 12 }}>
                Sweep completed in {(elapsed / 1000).toFixed(1)}s ·{' '}
                {endpoint.replace('https://', '').replace('http://', '').split('/')[0]}
              </Text>
            )}
          </>
        )}

        {/* Debug state panel */}
        <View className="flex-row items-center mb-3" style={{ marginTop: 32 }}>
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
          <View className="flex-row items-center justify-between pt-2">
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
          className="rounded-2xl py-3.5 items-center active:opacity-80 flex-row justify-center"
          style={{
            backgroundColor: colors.surfaceAlt,
            borderWidth: 1,
            borderColor: colors.border,
            marginTop: 14,
          }}
        >
          <Ionicons name="terminal-outline" size={16} color={colors.accent} />
          <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '700', marginLeft: 8 }}>
            Log State to Console
          </Text>
        </Pressable>

        {logged && (
          <Text style={{ color: colors.online, fontSize: 11, textAlign: 'center', marginTop: 10 }}>
            Snapshot logged at {new Date(logged.capturedAt).toLocaleTimeString()} — check Metro
            logs
          </Text>
        )}

        <Text style={{ color: colors.textFaint, fontSize: 11, textAlign: 'center', marginTop: 16 }}>
          Connectivity and cloud-sync checks hit the live server; mesh and battery checks grade
          the current fleet telemetry.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
