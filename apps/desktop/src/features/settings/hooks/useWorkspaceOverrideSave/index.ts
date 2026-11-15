import { useCallback } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { WorkspaceOverridesPatch } from '../../../../store/slices/overrides/patchWorkspaceOverrides';
import type { WorkspaceSettingField } from '../../pageKeys';
import { settingRowKey } from '../../settingRowKey';
import { fieldDef, type FieldValue } from '../../workspaceSettings/fields';
import { useSettingSave, type SettingSave } from '../useSettingSave';

type ValueParams<Value> = {
  readonly value: Value;
};

type Params<Value extends FieldValue> = {
  readonly workspaceId: WorkspaceId;
  readonly field: WorkspaceSettingField;
  readonly saved: Value;
  readonly patchOf: (params: ValueParams<Value>) => WorkspaceOverridesPatch;
};

export const useWorkspaceOverrideSave = <Value extends FieldValue>({
  workspaceId,
  field,
  saved,
  patchOf,
}: Params<Value>): SettingSave<Value> => {
  const def = fieldDef({ field });
  const patchWorkspaceOverrides = useAppStore((state) => state.patchWorkspaceOverrides);
  const write = useCallback(
    ({ value }: ValueParams<Value>) =>
      patchWorkspaceOverrides({ workspaceId, patch: patchOf({ value }) }),
    [patchOf, patchWorkspaceOverrides, workspaceId],
  );
  return useSettingSave({
    rowKey: settingRowKey({ workspaceId, row: field }),
    saved,
    write,
    display: ({ value }) => def.display(value),
    failureTitle: `Couldn't save ${def.label.toLowerCase()}`,
    workspaceId,
  });
};
