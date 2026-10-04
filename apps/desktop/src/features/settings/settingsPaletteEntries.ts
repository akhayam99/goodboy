import { CONCEPT_ICONS } from '../../shared/components/conceptIcons';
import type { PaletteEntry } from '../palette/types';
import type { SettingsGroup } from './components/SettingsStudio/settingsDirectory';
import type { SettingsFlow, SettingsFocus } from './settingsFocus';

type Params = {
  readonly groups: ReadonlyArray<SettingsGroup>;
  readonly open: (focus: SettingsFocus) => void;
};

const PREFIX: Readonly<Record<SettingsGroup['scope'], string>> = {
  app: 'Settings',
  workspace: 'Workspace settings',
  providers: 'Providers',
  tools: 'Integrations',
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

export const settingsPaletteEntries = ({ groups, open }: Params): ReadonlyArray<PaletteEntry> => {
  const pages = groups.flatMap((group) =>
    group.pages.map((page): PaletteEntry => ({
      key: `setting:${page.key}`,
      label: page.label === group.label ? page.label : `${PREFIX[group.scope]}: ${page.label}`,
      kind: 'setting',
      group: 'action',
      icon: CONCEPT_ICONS[group.concept],
      tag: 'Settings',
      run: () => open({ ...page.target }),
    })),
  );
  if (!groups.some((group) => group.scope === 'workspace')) {
    return pages;
  }
  return [
    ...pages,
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
