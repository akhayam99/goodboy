import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { SettingsNavRow } from '../../../../shared/components/SettingsNavRow';
import type { SettingsScopeChange } from '../../settingsFocus';
import type { SettingsGroup } from './settingsDirectory';
import { SettingsPageIcon } from './SettingsPageIcon';

type Props = {
  readonly group: SettingsGroup;
  readonly isCurrentGroup: boolean;
  readonly pageKey: string | null;
  readonly onSelect: (params: SettingsScopeChange) => void;
};

export const SettingsRailPageGroup = ({ group, isCurrentGroup, pageKey, onSelect }: Props) => {
  const Icon = CONCEPT_ICONS[group.concept];
  return (
    <div data-settings-group={group.scope} className="flex flex-col gap-0.5">
      <SettingsNavRow
        level="group"
        icon={<Icon size={ICON_SIZE.control} />}
        label={group.label}
        isActiveGroup={isCurrentGroup}
        status={
          group.tone === undefined ? null : { tone: group.tone, label: group.attention ?? null }
        }
        onClick={() => onSelect({ scope: group.scope })}
      />
      <ul aria-label={`${group.label} settings`} className="flex flex-col gap-0.5">
        {group.pages.map((page) => (
          <li key={page.key} data-settings-page={page.key}>
            <SettingsNavRow
              level="page"
              icon={<SettingsPageIcon glyph={page.glyph} size={ICON_SIZE.row} />}
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
    </div>
  );
};
