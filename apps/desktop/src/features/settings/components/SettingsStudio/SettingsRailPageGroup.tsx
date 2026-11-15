import type { SettingsPageScope, SettingsScopeChange } from '../../settingsFocus';
import type { SettingsGroup } from './settingsDirectory';
import { SettingsRailHeading } from './SettingsRailHeading';
import { SettingsRailPageList } from './SettingsRailPageList';

type Props = {
  readonly group: SettingsGroup;
  readonly pageKey: string | null;
  readonly onSelect: (params: SettingsScopeChange) => void;
};

const SCOPE_CAPTION: Readonly<Record<SettingsPageScope, string>> = {
  app: 'every workspace',
  workspace: 'this workspace',
};

export const SettingsRailPageGroup = ({ group, pageKey, onSelect }: Props) => (
  <div data-settings-group={group.scope} className="flex flex-col gap-1">
    <SettingsRailHeading label={group.label} caption={SCOPE_CAPTION[group.scope]} />
    <SettingsRailPageList group={group} pageKey={pageKey} onSelect={onSelect} />
  </div>
);
