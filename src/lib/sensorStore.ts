import { useCallback, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { useSession } from '../../lib/auth-client';
import { api } from '../../convex/_generated/api';
import { mockSensors, type Sensor } from './mockData';
import { notifySuccess, notifyError } from './notify';

// Sensor naming + power state is now persisted to Shipper Cloud (Convex)
// per-user. We merge the user's saved settings on top of the mock catalog
// so every screen (Dashboard, Sensors list, Detail) stays in sync via the
// live Convex query.

type SettingDoc = {
  _id: string;
  sensorId: string;
  customName?: string;
  isOn?: boolean;
};

function mergeSensors(settings: SettingDoc[] | undefined): Sensor[] {
  const map = new Map<string, SettingDoc>();
  (settings ?? []).forEach((s) => map.set(s.sensorId, s));
  return mockSensors.map((s) => {
    const saved = map.get(s.id);
    return {
      ...s,
      defaultName: saved?.customName ?? s.defaultName,
      isOn: saved?.isOn ?? s.isOn,
    };
  });
}

export function useSensors() {
  const { data: session } = useSession();
  const settings = useQuery(
    api.queries.listSensorSettings,
    session ? {} : 'skip',
  ) as SettingDoc[] | undefined;

  const createSetting = useMutation(api.mutations.createSensorSetting);
  const updateSetting = useMutation(api.mutations.updateSensorSetting);

  const sensors = useMemo(() => mergeSensors(settings), [settings]);

  const findSetting = useCallback(
    (sensorId: string) => (settings ?? []).find((s) => s.sensorId === sensorId),
    [settings],
  );

  const renameSensor = useCallback(
    async (id: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const existing = findSetting(id);
      try {
        if (existing) {
          await updateSetting({
            id: existing._id as any,
            customName: trimmed,
            updatedAt: Date.now(),
          });
        } else {
          await createSetting({
            sensorId: id,
            customName: trimmed,
            updatedAt: Date.now(),
          });
        }
        notifySuccess('Sensor renamed', `Now "${trimmed}"`);
      } catch (e) {
        notifyError('Rename failed', e instanceof Error ? e.message : 'Please try again');
        throw e;
      }
    },
    [findSetting, createSetting, updateSetting],
  );

  const toggleSensor = useCallback(
    async (id: string, value: boolean) => {
      const existing = findSetting(id);
      const label = mockSensors.find((s) => s.id === id)?.defaultName ?? 'Device';
      try {
        if (existing) {
          await updateSetting({
            id: existing._id as any,
            isOn: value,
            updatedAt: Date.now(),
          });
        } else {
          await createSetting({
            sensorId: id,
            isOn: value,
            updatedAt: Date.now(),
          });
        }
        notifySuccess(`${label} valve ${value ? 'opened' : 'shut'}`);
      } catch (e) {
        notifyError('Command failed', e instanceof Error ? e.message : 'Could not reach device');
        throw e;
      }
    },
    [findSetting, createSetting, updateSetting],
  );

  return {
    sensors,
    renameSensor,
    toggleSensor,
    ready: settings !== undefined || !session,
  };
}

export function useSensor(id: string | undefined) {
  const { sensors, renameSensor, toggleSensor, ready } = useSensors();
  const sensor = sensors.find((s) => s.id === id);
  return { sensor, renameSensor, toggleSensor, ready };
}
