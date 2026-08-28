import { useCallback } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { useSession } from '../../lib/auth-client';
import { api } from '../../convex/_generated/api';
import { notifySuccess, notifyError } from './notify';

// Scenes are one-tap shortcuts that set multiple shut-off valves to a target
// state at once. Persisted to Shipper Cloud per-user; triggering applies every
// action in a single atomic mutation so all devices update simultaneously.

export interface SceneAction {
  sensorId: string;
  valveOpen: boolean;
}

export interface Scene {
  _id: string;
  name: string;
  icon?: string;
  color?: string;
  actions: SceneAction[];
  lastTriggeredAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface ScenePreset {
  name: string;
  icon: string;
  color: string;
  description: string;
  /** Default valve state applied to every selected device. */
  valveOpen: boolean;
}

// Suggested starting points the user can customize.
export const SCENE_PRESETS: ScenePreset[] = [
  {
    name: 'Vacation',
    icon: 'airplane',
    color: '#818CF8',
    description: 'Shut every valve while you are away',
    valveOpen: false,
  },
  {
    name: 'Night Mode',
    icon: 'moon',
    color: '#60A5FA',
    description: 'Close valves overnight to prevent leaks',
    valveOpen: false,
  },
  {
    name: 'Home',
    icon: 'home',
    color: '#34D399',
    description: 'Open all valves for normal use',
    valveOpen: true,
  },
  {
    name: 'Custom',
    icon: 'construct',
    color: '#7EE2BE',
    description: 'Build a scene from scratch',
    valveOpen: false,
  },
];

export function useScenes() {
  const { data: session } = useSession();
  const scenes = useQuery(
    api.queries.listScenes,
    session ? {} : 'skip',
  ) as Scene[] | undefined;

  const createMutation = useMutation(api.mutations.createScene);
  const updateMutation = useMutation(api.mutations.updateScene);
  const deleteMutation = useMutation(api.mutations.deleteScene);
  const triggerMutation = useMutation(api.mutations.triggerScene);

  const createScene = useCallback(
    async (input: { name: string; icon?: string; color?: string; actions: SceneAction[] }) => {
      try {
        await createMutation(input);
        notifySuccess('Scene created', `"${input.name}" is ready`);
      } catch (e) {
        notifyError('Could not create scene', e instanceof Error ? e.message : 'Please try again');
        throw e;
      }
    },
    [createMutation],
  );

  const updateScene = useCallback(
    async (input: { id: string; name?: string; icon?: string; color?: string; actions?: SceneAction[] }) => {
      const { id, ...rest } = input;
      try {
        await updateMutation({ id: id as any, ...rest });
        notifySuccess('Scene updated');
      } catch (e) {
        notifyError('Could not update scene', e instanceof Error ? e.message : 'Please try again');
        throw e;
      }
    },
    [updateMutation],
  );

  const deleteScene = useCallback(
    async (id: string) => {
      try {
        await deleteMutation({ id: id as any });
        notifySuccess('Scene deleted');
      } catch (e) {
        notifyError('Could not delete scene', e instanceof Error ? e.message : 'Please try again');
        throw e;
      }
    },
    [deleteMutation],
  );

  const triggerScene = useCallback(
    async (scene: Scene) => {
      try {
        const res = (await triggerMutation({ id: scene._id as any })) as { applied: number };
        notifySuccess(`${scene.name} activated`, `${res.applied} device${res.applied === 1 ? '' : 's'} updated`);
      } catch (e) {
        notifyError('Scene failed', e instanceof Error ? e.message : 'Could not reach devices');
        throw e;
      }
    },
    [triggerMutation],
  );

  return {
    scenes,
    ready: scenes !== undefined || !session,
    createScene,
    updateScene,
    deleteScene,
    triggerScene,
  };
}
