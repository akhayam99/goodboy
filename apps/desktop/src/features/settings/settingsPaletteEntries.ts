import { CONCEPT_ICONS } from '../../shared/components/conceptIcons';
import type { PaletteEntry } from '../palette/types';
import type { SettingsGroup } from './components/SettingsStudio/settingsDirectory';
import type { SettingsFocus } from './settingsFocus';

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

export const settingsPaletteEntries = ({ groups, open }: Params): ReadonlyArray<PaletteEntry> =>
  groups.flatMap((group) =>
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
