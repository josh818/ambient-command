import { useCallback } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { useSession } from '../../lib/auth-client';
import { api } from '../../convex/_generated/api';
import { notifySuccess, notifyError } from './notify';
import { issueCommand } from './api';

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
        // 1) Persist the requested valve states (app-side desired state).
        await triggerMutation({ id: scene._id as any });
        // 2) Fire the REAL hardware command for every action in the scene, in
        //    parallel. Each action's sensorId IS the module_id. Commands are
        //    queued server-side and apply on each module's next check-in.
        const results = await Promise.allSettled(
          scene.actions.map((a) =>
            issueCommand(a.sensorId, a.valveOpen ? 'VALVE,OPEN' : 'VALVE,CLOSE'),
          ),
        );
        const queued = results.filter((r) => r.status === 'fulfilled').length;
        const failed = results.length - queued;
        if (failed === 0) {
          notifySuccess(
            `${scene.name} activated`,
            `${queued} valve command${queued === 1 ? '' : 's'} queued · apply on next check-in`,
          );
        } else if (queued > 0) {
          notifyError(
            `${scene.name}: partial`,
            `${queued} queued, ${failed} could not be sent. Retry, or set those valves individually.`,
          );
        } else {
          notifyError('Scene failed', 'No valve commands could be sent. Check the connection and retry.');
        }
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
