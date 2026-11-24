import { SettingsNavRow } from '../../../../shared/components/SettingsNavRow';
import type { SettingsScopeChange } from '../../settingsFocus';
import type { SettingsGroup } from './settingsDirectory';

type Props = {
  readonly group: SettingsGroup;
  readonly pageKey: string | null;
  readonly onSelect: (params: SettingsScopeChange) => void;
};

export const SettingsRailPageList = ({ group, pageKey, onSelect }: Props) => (
  <ul aria-label={`${group.label} settings`} className="flex flex-col gap-0.5">
    {group.pages
      .filter((page) => page.isLink !== true && (page.isHidden !== true || page.key === pageKey))
      .map((page) => (
        <li key={page.key} data-settings-page={page.key}>
          <SettingsNavRow
            label={page.label}
            isCurrent={page.key === pageKey}
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
