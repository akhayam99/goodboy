import { NAMES } from '../../shared/utils/names';
import { APP_SECTIONS, appSectionOf } from './components/SettingsStudio/appSections';
import { workspacePageEntry, workspacePageOf } from './components/SettingsStudio/workspacePages';
import { isModelsPage } from './isModelsPage';
import type { SettingRow } from './settingRows';

type Params = {
  readonly row: SettingRow;
};

const pageLabelOf = ({ row }: Params): string => {
  const { scope, section } = row.page;
  if (scope === 'app') {
    const id = appSectionOf({ section });
    return APP_SECTIONS.find((entry) => entry.id === id)?.label ?? id;
  }
  if (isModelsPage({ section })) {
    return NAMES.models;
  }
  return workspacePageEntry({ page: workspacePageOf({ section }) }).label;
};

export const settingRowPlace = ({ row }: Params): string => {
  const page = pageLabelOf({ row });
  return row.band === null ? page : `${page} · ${row.band}`;
};
