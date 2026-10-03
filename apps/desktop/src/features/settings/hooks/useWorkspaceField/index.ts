import { useCallback } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { WorkspaceSettingField } from '../../pageKeys';
import { fieldDef, isChanged } from '../../workspaceSettings/fields';
import { applyWorkspaceSettings } from '../../workspaceSettings/plan';
import { workspaceSettingsSnapshot } from '../../workspaceSettings/snapshot';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly field: WorkspaceSettingField;
};

export type WorkspaceFieldState = {
  readonly label: string;
  readonly isChanged: boolean;
  readonly defaultLabel: string;
  readonly reset: () => Promise<void>;
};

export const useWorkspaceField = ({ workspaceId, field }: Params): WorkspaceFieldState => {
  const def = fieldDef({ field });
  const changed = useAppStore((state) =>
    isChanged({ def, snapshot: workspaceSettingsSnapshot({ state, workspaceId }) }),
  );
  const reportError = useAppStore((state) => state.reportError);

  const reset = useCallback(async () => {
    try {
      await applyWorkspaceSettings({
        state: useAppStore.getState(),
        workspaceId,
        writes: [def.write(null)],
      });
    } catch (error) {
      void reportError({ title: `Couldn't reset ${def.label.toLowerCase()}`, error, workspaceId });
    }
  }, [def, reportError, workspaceId]);

  return {
    label: def.label,
    isChanged: changed,
    defaultLabel: def.display(def.fallback),
    reset,
  };
};
