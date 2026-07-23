import { useState } from 'react';
import type { AuxTaskId, OverrideSettings, TaskModelPreference, WorkspaceId } from '@goodboy/types';
import { formatError } from '../../../../../shared/lib/errors';
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

  return { busy, error, persistOverrides, persistTaskModel };
};
