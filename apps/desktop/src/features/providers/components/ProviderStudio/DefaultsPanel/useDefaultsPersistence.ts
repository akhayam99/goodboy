import { useState } from 'react';
import { TASKS } from '@goodboy/core';
import { formatError } from '@goodboy/ui';
import type {
  AgentRole,
  AuxTaskId,
  RoleModelPreference,
  TaskModelPreference,
  TaskModelPreferences,
  WorkspaceId,
} from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import type { WorkspaceOverridesPatch } from '../../../../../store/slices/overrides/patchWorkspaceOverrides';

type Params = {
  readonly workspaceId: WorkspaceId;
};

type PersistParams = {
  readonly patch: WorkspaceOverridesPatch;
};

type PersistTaskModelParams = {
  readonly task: AuxTaskId;
  readonly preference: TaskModelPreference | null;
};

type PersistRoleModelParams = {
  readonly role: AgentRole;
  readonly preference: RoleModelPreference | null;
};

type KnownTaskModelsParams = {
  readonly taskModels: TaskModelPreferences | null;
};

const knownTaskModels = ({
  taskModels,
}: KnownTaskModelsParams): Partial<Record<AuxTaskId, TaskModelPreference>> =>
  Object.fromEntries(
    TASKS.flatMap(({ id }) => {
      const preference = taskModels?.[id];
      return preference == null ? [] : [[id, preference]];
    }),
  );

export const useDefaultsPersistence = ({ workspaceId }: Params) => {
  const patchWorkspaceOverrides = useAppStore((state) => state.patchWorkspaceOverrides);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentOverrides = () => useAppStore.getState().workspaceOverrides[workspaceId] ?? null;

  const persistOverrides = async ({ patch }: PersistParams) => {
    setBusy(true);
    setError(null);
    try {
      await patchWorkspaceOverrides({ workspaceId, patch });
    } catch (caught) {
      setError(formatError(caught));
    } finally {
      setBusy(false);
    }
  };

  const persistTaskModel = ({ task, preference }: PersistTaskModelParams) => {
    const taskModels = knownTaskModels({ taskModels: currentOverrides()?.taskModels ?? null });
    if (preference == null) {
      delete taskModels[task];
    }
    if (preference != null) {
      taskModels[task] = preference;
    }
    void persistOverrides({
      patch: { taskModels: Object.keys(taskModels).length > 0 ? taskModels : null },
    });
  };

  const persistRoleModel = ({ role, preference }: PersistRoleModelParams) => {
    const roleModels = { ...(currentOverrides()?.roleModels ?? {}) };
    if (preference == null) {
      delete roleModels[role];
    }
    if (preference != null) {
      roleModels[role] = preference;
    }
    void persistOverrides({
      patch: { roleModels: Object.keys(roleModels).length > 0 ? roleModels : null },
    });
  };

  return { busy, error, persistOverrides, persistTaskModel, persistRoleModel };
};
