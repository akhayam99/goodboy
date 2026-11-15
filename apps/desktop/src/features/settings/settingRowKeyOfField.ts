import type { WorkspaceSettingField } from './pageKeys';
import { SETTING_ROWS } from './settingRows';

type Params = {
  readonly field: WorkspaceSettingField;
};

export const settingRowKeyOfField = ({ field }: Params): string | undefined =>
  SETTING_ROWS.find((entry) => entry.field === field)?.key;
