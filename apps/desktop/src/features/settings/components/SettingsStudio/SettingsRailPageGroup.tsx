import { Eyebrow } from '@goodboy/ui';
import type { SettingsScopeChange } from '../../settingsFocus';
import type { SettingsGroup } from './settingsDirectory';
import { SettingsRailPageList } from './SettingsRailPageList';

type Props = {
  readonly group: SettingsGroup;
  readonly label: string;
  readonly isCurrentGroup: boolean;
  readonly pageKey: string | null;
  readonly onSelect: (params: SettingsScopeChange) => void;
};

export const SettingsRailPageGroup = ({
  group,
  label,
  isCurrentGroup,
  pageKey,
  onSelect,
}: Props) => (
  <div data-settings-group={group.scope} className="flex flex-col gap-1">
    <h2 className="flex h-6 items-center px-2">
      <Eyebrow muted label={label} />
    </h2>
    <SettingsRailPageList
      group={group}
      isCurrentGroup={isCurrentGroup}
      pageKey={pageKey}
      onSelect={onSelect}
    />
  </div>
);
