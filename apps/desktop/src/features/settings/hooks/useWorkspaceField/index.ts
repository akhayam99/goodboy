import { useCallback } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { WorkspaceSettingField } from '../../pageKeys';
import { settingRowKey } from '../../settingRowKey';
import { effectiveValue, fieldDef, isChanged } from '../../workspaceSettings/fields';
import { applyWorkspaceSettings } from '../../workspaceSettings/plan';
import { workspaceSettingsSnapshot } from '../../workspaceSettings/snapshot';
import { useSettingSave, type SettingSave } from '../useSettingSave';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly field: WorkspaceSettingField;
};

export type WorkspaceFieldState = {
  readonly label: string;
  readonly isChanged: boolean;
  readonly defaultLabel: string;
  readonly reset: () => Promise<void>;
  readonly save: Pick<SettingSave<string>, 'error' | 'isSaving' | 'retry'>;
};

export const useWorkspaceField = ({ workspaceId, field }: Params): WorkspaceFieldState => {
  const def = fieldDef({ field });
  const changed = useAppStore((state) =>
    isChanged({ def, snapshot: workspaceSettingsSnapshot({ state, workspaceId }) }),
  );
  const currentLabel = useAppStore((state) =>
    def.display(
      effectiveValue({ def, snapshot: workspaceSettingsSnapshot({ state, workspaceId }) }),
    ),
  );
  const defaultLabel = def.display(def.fallback);

  const write = useCallback(
    () =>
      applyWorkspaceSettings({
        state: useAppStore.getState(),
        workspaceId,
        writes: [def.write(null)],
      }),
    [def, workspaceId],
  );

  const save = useSettingSave({
    rowKey: settingRowKey({ workspaceId, row: field }),
    saved: currentLabel,
    write,
    display: ({ value }) => value,
    failureTitle: `Couldn't reset ${def.label.toLowerCase()}`,
    workspaceId,
  });
  const { save: send } = save;

  const reset = useCallback(() => send({ value: defaultLabel }), [defaultLabel, send]);

  return {
    label: def.label,
    isChanged: changed,
    defaultLabel,
    reset,
    save,
  };
};
