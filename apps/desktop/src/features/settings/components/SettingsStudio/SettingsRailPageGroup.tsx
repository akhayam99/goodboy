import type { ReactNode } from 'react';
import { Eyebrow } from '@goodboy/ui';
import type { SettingsScopeChange } from '../../settingsFocus';
import type { SettingsGroup } from './settingsDirectory';
import { SettingsRailPageList } from './SettingsRailPageList';

type Props = {
  readonly group: SettingsGroup;
  readonly label: string;
  readonly pageKey: string | null;
  readonly onSelect: (params: SettingsScopeChange) => void;
  readonly children?: ReactNode;
};

export const SettingsRailPageGroup = ({ group, label, pageKey, onSelect, children }: Props) => (
  <div data-settings-group={group.scope} className="flex flex-col gap-1">
    <h2 className="flex h-6 items-center px-2">
      <Eyebrow muted label={label} />
    </h2>
    <SettingsRailPageList group={group} pageKey={pageKey} onSelect={onSelect} />
    {children}
  </div>
);
