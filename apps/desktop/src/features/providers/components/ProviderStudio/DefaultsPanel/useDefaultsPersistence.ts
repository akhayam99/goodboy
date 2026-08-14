import { useState } from 'react';
import { formatError } from '@goodboy/ui';
import type {
  AgentRole,
  AuxTaskId,
  OverrideSettings,
  RoleModelPreference,
  TaskModelPreference,
  WorkspaceId,
} from '@goodboy/types';
import { useAppStore } from '../../../../../store';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly overrides: OverrideSettings;
};

type PersistParams = {
  readonly partial: Partial<OverrideSettings>;
};

type PersistTaskModelParams = {
  readonly task: AuxTaskId;
  readonly preference: TaskModelPreference | null;
};

type PersistRoleModelParams = {
  readonly role: AgentRole;
  readonly preference: RoleModelPreference | null;
};

export const useDefaultsPersistence = ({ workspaceId, overrides }: Params) => {
  const setWorkspaceOverrides = useAppStore((state) => state.setWorkspaceOverrides);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const persistOverrides = async ({ partial }: PersistParams) => {
    setBusy(true);
    setError(null);
    try {
      await setWorkspaceOverrides(workspaceId, { ...overrides, ...partial });
    } catch (caught) {
      setError(formatError(caught));
    } finally {
      setBusy(false);
    }
  };

  const persistTaskModel = ({ task, preference }: PersistTaskModelParams) => {
    const taskModels = { ...(overrides.taskModels ?? {}) };
    if (preference == null) {
      delete taskModels[task];
    }
    if (preference != null) {
      taskModels[task] = preference;
    }
    void persistOverrides({
      partial: {
        taskModels: Object.keys(taskModels).length > 0 ? taskModels : null,
      },
    });
  };

  const persistRoleModel = ({ role, preference }: PersistRoleModelParams) => {
    const roleModels = { ...(overrides.roleModels ?? {}) };
    if (preference == null) {
      delete roleModels[role];
    }
    if (preference != null) {
      roleModels[role] = preference;
    }
    void persistOverrides({
      partial: {
        roleModels: Object.keys(roleModels).length > 0 ? roleModels : null,
      },
    });
  };

  return { busy, error, persistOverrides, persistTaskModel, persistRoleModel };
};
