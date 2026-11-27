import { effectiveValue, fieldDef, isChanged } from '../../settings/workspaceSettings/fields';
import type { WorkspaceSettingsSnapshot } from '../../settings/workspaceSettings/snapshot';
import { FIELD_PAGE, type WorkspaceSettingField } from '../../settings/pageKeys';

type Params = {
  readonly snapshot: WorkspaceSettingsSnapshot;
  readonly only?: ReadonlyArray<WorkspaceSettingField>;
};

export type SetupRow = {
  readonly id: WorkspaceSettingField;
  readonly label: string;
  readonly value: string;
};

const ALL_FIELDS = Object.keys(FIELD_PAGE).filter((key): key is WorkspaceSettingField =>
  Object.hasOwn(FIELD_PAGE, key),
);

export const setupDiffOf = ({ snapshot, only }: Params): ReadonlyArray<SetupRow> =>
  (only ?? ALL_FIELDS).flatMap((id) => {
    const def = fieldDef({ field: id });
    return isChanged({ def, snapshot })
      ? [{ id, label: def.label, value: def.display(effectiveValue({ def, snapshot })) }]
      : [];
  });
