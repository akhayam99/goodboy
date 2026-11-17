import { CONCEPT_ICONS } from '../../shared/components/conceptIcons';
import { NAMES, formerNamesOf } from '../../shared/utils/names';
import { openConnection } from '../connections/openConnection';
import type { PaletteEntry } from '../palette/types';
import type { SettingsGroup } from './components/SettingsStudio/settingsDirectory';
import { availableSettingRows } from './availableSettingRows';
import { settingRowPlace } from './settingRowPlace';
import type { SettingsFlow, SettingsFocus } from './settingsFocus';

type Params = {
  readonly groups: ReadonlyArray<SettingsGroup>;
  readonly open: (focus: SettingsFocus) => void;
};

const PREFIX: Readonly<Record<SettingsGroup['scope'], string>> = {
  app: 'Settings',
  workspace: 'Workspace settings',
};

export const CONNECTIONS_SETTING_KEY = 'setting:connections';

const connectionsEntry: PaletteEntry = {
  key: CONNECTIONS_SETTING_KEY,
  label: `Go to ${NAMES.connections}`,
  kind: 'setting',
  group: 'action',
  icon: CONCEPT_ICONS.connections,
  tag: 'Settings',
  secondary: [NAMES.providers, 'Integrations'],
  run: () => openConnection({ focus: null }),
};

const flowEntry = ({
  flow,
  label,
  icon,
  open,
}: {
  readonly flow: SettingsFlow;
  readonly label: string;
  readonly icon: PaletteEntry['icon'];
  readonly open: Params['open'];
}): PaletteEntry => ({
  key: `setting:workspace:flow:${flow}`,
  label,
  kind: 'setting',
  group: 'action',
  icon,
  tag: 'Settings',
  run: () => open({ scope: 'workspace', flow }),
});

export const SETTING_ROW_KEY_PREFIX = 'setting:row:';

const rowEntries = ({ groups, open }: Params): ReadonlyArray<PaletteEntry> =>
  availableSettingRows({ groups }).map((row): PaletteEntry => {
    const group = groups.find((candidate) => candidate.scope === row.page.scope);
    return {
      key: `${SETTING_ROW_KEY_PREFIX}${row.key}`,
      label: row.label,
      kind: 'setting',
      group: 'action',
      icon: CONCEPT_ICONS[group?.concept ?? 'settings'],
      tag: 'Setting',
      detail: settingRowPlace({ row }),
      secondary: row.formerNames,
      run: () => open({ ...row.page, row: row.key }),
    };
  });

export const settingsPaletteEntries = ({ groups, open }: Params): ReadonlyArray<PaletteEntry> => {
  const rows = rowEntries({ groups, open });
  const pages = groups.flatMap((group) =>
    group.pages.map((page): PaletteEntry => ({
      key: `setting:${page.key}`,
      label: page.label === group.label ? page.label : `${PREFIX[group.scope]}: ${page.label}`,
      kind: 'setting',
      group: 'action',
      icon: CONCEPT_ICONS[group.concept],
      tag: 'Settings',
      secondary: [...formerNamesOf(page.label), ...(page.searchAliases ?? [])],
      run: () => open({ ...page.target }),
    })),
  );
  if (!groups.some((group) => group.scope === 'workspace')) {
    return [...pages, connectionsEntry, ...rows];
  }
  return [
    ...pages,
    connectionsEntry,
    ...rows,
    flowEntry({
      flow: 'copy',
      label: 'Copy settings from another workspace',
      icon: CONCEPT_ICONS.workspace,
      open,
    }),
    flowEntry({
      flow: 'restore',
      label: 'Restore workspace defaults',
      icon: CONCEPT_ICONS.refresh,
      open,
    }),
  ];
};
