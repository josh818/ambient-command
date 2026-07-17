import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors } from '../constants/theme';
import {
  sensorTypeMeta,
  formatRelativeTime,
  formatSensorValue,
  isLeaking,
  type Sensor,
} from '../lib/mockData';
import { StatusPill } from './StatusPill';
import { LiveDot } from './LiveDot';
import { Sparkline } from './Sparkline';
import { useSparkline } from '../lib/sparkHistory';

function batteryIcon(volts: number | undefined): {
  name: string;
  color: string;
} {
  if (volts === undefined) return { name: 'battery-half-outline', color: colors.textFaint };
  if (volts >= 3.9) return { name: 'battery-full', color: colors.online };
  if (volts >= 3.6) return { name: 'battery-half', color: colors.warning };
  return { name: 'battery-dead', color: colors.danger };
}

function signalIcon(sensor: Sensor): { name: string; color: string } {
  if (!sensor.hasTelemetry) return { name: 'cellular-outline', color: colors.textFaint };
  if (sensor.status === 'offline') return { name: 'cloud-offline-outline', color: colors.offline };
  return { name: 'cellular', color: colors.online };
}

export function SensorCard({ sensor }: { sensor: Sensor }) {
  const router = useRouter();
  const meta = sensorTypeMeta[sensor.type];
  const spark = useSparkline(sensor.id);

  const live = sensor.hasTelemetry && sensor.status !== 'offline';
  const batt = batteryIcon(sensor.batteryVolts);
  const sig = signalIcon(sensor);

  return (
    <Pressable
      onPress={() => router.push(`/sensor/${sensor.id}`)}
      className="rounded-2xl p-4 active:opacity-80"
      style={{
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: 12,
      }}
    >
      <View className="flex-row items-center">
        <View
          className="w-11 h-11 rounded-xl items-center justify-center mr-3"
          style={{ backgroundColor: colors.surfaceAlt }}
        >
          <Ionicons
            name={meta.icon as any}
            size={22}
            color={
              sensor.status === 'offline' || sensor.status === 'unknown'
                ? colors.offline
                : colors.primary
            }
          />
          {live && (
            <View style={{ position: 'absolute', top: -2, right: -2 }}>
              <LiveDot color={isLeaking(sensor) ? colors.danger : colors.online} size={8} />
            </View>
          )}
        </View>

        <View className="flex-1" style={{ paddingRight: 8 }}>
          <Text
            numberOfLines={1}
            style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}
          >
            {sensor.defaultName}
          </Text>
          <Text style={{ color: colors.textFaint, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
            {sensor.location} · {meta.label}
          </Text>
        </View>

        <View className="items-end">
          <Text
            style={{
              color: !sensor.hasTelemetry
                ? colors.textFaint
                : sensor.status === 'offline'
                  ? colors.textFaint
                  : isLeaking(sensor)
                    ? colors.danger
                    : colors.online,
              fontSize: 16,
              fontWeight: '800',
            }}
          >
            {formatSensorValue(sensor)}
          </Text>
          {/* 24h sparkline from real server measurements (hidden when none) */}
          {spark && spark.length >= 2 ? (
            <View style={{ marginTop: 4 }}>
              <Sparkline
                data={spark}
                color={isLeaking(sensor) ? colors.danger : colors.primary}
              />
            </View>
          ) : (
            <Text style={{ color: colors.textFaint, fontSize: 11, marginTop: 2 }}>
              {sensor.hasTelemetry ? formatRelativeTime(sensor.lastUpdate) : 'N/A'}
            </Text>
          )}
        </View>
      </View>

      <View
        className="flex-row items-center justify-between mt-3 pt-3"
        style={{ borderTopWidth: 1, borderTopColor: colors.border }}
      >
        <StatusPill status={sensor.status} />
        <View className="flex-row items-center">
          <Ionicons name={batt.name as any} size={15} color={batt.color} />
          <Text style={{ color: colors.textMuted, fontSize: 12, marginLeft: 4, marginRight: 12 }}>
            {sensor.batteryVolts !== undefined ? `${sensor.batteryVolts.toFixed(2)}V` : 'N/A'}
          </Text>
          <Ionicons name={sig.name as any} size={14} color={sig.color} />
          <Text style={{ color: colors.textMuted, fontSize: 12, marginLeft: 4 }}>
            {sensor.systemVolts !== undefined ? `${sensor.systemVolts.toFixed(2)}V` : 'N/A'}
          </Text>
          {sensor.controllable && sensor.hasTelemetry && (
            <View
              className="ml-3 px-2 py-0.5 rounded-full"
              style={{ backgroundColor: sensor.isOn ? 'rgba(45,212,191,0.15)' : 'rgba(248,113,113,0.15)' }}
            >
              <Text
                style={{
                  color: sensor.isOn ? colors.primary : colors.danger,
                  fontSize: 10,
                  fontWeight: '700',
                }}
              >
                {sensor.isOn ? 'VALVE OPEN' : 'VALVE SHUT'}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}
