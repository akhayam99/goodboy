import { SettingsNavRow } from '../../../../shared/components/SettingsNavRow';
import type { SettingsScopeChange } from '../../settingsFocus';
import type { SettingsGroup } from './settingsDirectory';

type Props = {
  readonly group: SettingsGroup;
  readonly isCurrentGroup: boolean;
  readonly pageKey: string | null;
  readonly onSelect: (params: SettingsScopeChange) => void;
  readonly id?: string;
};

export const SettingsRailPageList = ({ group, isCurrentGroup, pageKey, onSelect, id }: Props) => (
  <ul id={id} aria-label={`${group.label} settings`} className="flex flex-col gap-0.5">
    {group.pages.map((page) => (
      <li key={page.key} data-settings-page={page.key}>
        <SettingsNavRow
          label={page.label}
          isCurrent={isCurrentGroup && page.key === pageKey}
          status={
            page.attention === null
              ? null
              : { tone: page.attention.tone, label: page.attention.text }
          }
          onClick={() => onSelect(page.target)}
        />
      </li>
    ))}
  </ul>
);
