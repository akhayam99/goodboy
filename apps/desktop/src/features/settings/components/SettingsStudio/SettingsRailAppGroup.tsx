import { PANE_RHYTHM, StatusRailItem, cn } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { SettingsPageScope, SettingsScopeChange } from '../../settingsFocus';
import type { AppSection } from './appSections';
import type { SettingsGroup } from './settingsDirectory';
import { SettingsPageIcon } from './SettingsPageIcon';

type Props = {
  readonly group: SettingsGroup;
  readonly scope: SettingsPageScope;
  readonly appSection: AppSection;
  readonly onSelect: (params: SettingsScopeChange) => void;
};

const DANGER_ROW = 'text-danger hover:text-danger data-[selected=true]:text-danger';

export const SettingsRailAppGroup = ({ group, scope, appSection, onSelect }: Props) => (
  <div data-settings-group={group.scope} className="flex flex-col gap-0.5">
    <StatusRailItem
      icon={<CONCEPT_ICONS.settings size={ICON_SIZE.control} />}
      label={group.label}
      selected={false}
      onClick={() => onSelect({ scope: 'app' })}
      className={cn(scope === 'app' && 'text-foreground')}
    />
    <ul aria-label="App settings" className={cn('flex flex-col gap-0.5', PANE_RHYTHM.navRail.nest)}>
      {group.pages.map((page) => (
        <li key={page.key} data-settings-page={page.key}>
          <StatusRailItem
            icon={<SettingsPageIcon glyph={page.glyph} size={ICON_SIZE.row} />}
            label={page.label}
            density="compact"
            subtitle={page.attention?.text}
            tone={page.attention?.tone}
            statusLabel={page.key === 'app:general' ? page.attention?.text : undefined}
            selected={scope === 'app' && page.target.section === appSection}
            onClick={() => onSelect(page.target)}
            className={cn(page.isDanger && DANGER_ROW)}
          />
        </li>
      ))}
    </ul>
  </div>
);
