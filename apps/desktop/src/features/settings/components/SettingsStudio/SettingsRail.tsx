import type { ReactNode } from 'react';
import { PANE_RHYTHM, SelectableRow, cn } from '@goodboy/ui';
import { Boxes, Settings } from 'lucide-react';
import type { SettingsScopeChange, SettingsStudioScope } from './types';
import { APP_SECTIONS, type AppSection } from './appSections';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly scope: SettingsStudioScope;
  readonly appSection: AppSection;
  readonly workspaceName: string | null;
  readonly hasWorkspace: boolean;
  readonly nested: ReactNode;
  readonly onSelect: (params: SettingsScopeChange) => void;
};

const ITEMS = [
  { scope: 'app', label: 'App', icon: Settings, needsWorkspace: false },
  { scope: 'workspace', label: 'Workspace', icon: CONCEPT_ICONS.workspace, needsWorkspace: true },
  { scope: 'providers', label: 'Providers & models', icon: Boxes, needsWorkspace: false },
  { scope: 'tools', label: 'Tools', icon: CONCEPT_ICONS.integrations, needsWorkspace: true },
] satisfies ReadonlyArray<{
  scope: SettingsStudioScope;
  label: string;
  icon: typeof Settings;
  needsWorkspace: boolean;
}>;

export const settingsScopeAvailable = ({
  scope,
  hasWorkspace,
}: {
  readonly scope: SettingsStudioScope;
  readonly hasWorkspace: boolean;
}): boolean => hasWorkspace || ITEMS.some((item) => item.scope === scope && !item.needsWorkspace);

export const SettingsRail = ({
  scope,
  appSection,
  workspaceName,
  hasWorkspace,
  nested,
  onSelect,
}: Props) => (
  <nav aria-label="Settings scopes" className={`flex flex-col gap-1 ${PANE_RHYTHM.navRail.body}`}>
    {ITEMS.filter((item) => hasWorkspace || !item.needsWorkspace).map((item) => {
      const Icon = item.icon;
      const subtitle = item.scope === 'workspace' ? workspaceName : null;
      const isActive = scope === item.scope;
      const hasItems = item.scope === 'app' || (isActive && nested !== null);
      return (
        <div key={item.scope} className="flex flex-col gap-0.5">
          <SelectableRow
            selected={isActive && !hasItems}
            ariaCurrent={isActive && !hasItems}
            onClick={() => onSelect({ scope: item.scope })}
            className={cn(
              `items-center gap-2.5 ${PANE_RHYTHM.navRail.row}`,
              isActive && hasItems && 'text-foreground',
            )}
          >
            <Icon size={ICON_SIZE.control} aria-hidden className="shrink-0" />
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-medium">{item.label}</span>
              {subtitle !== null && (
                <span className="truncate text-2xs text-muted-foreground">{subtitle}</span>
              )}
            </span>
          </SelectableRow>
          {isActive && item.scope !== 'app' && nested}
          {isActive && item.scope === 'app' && (
            <ul aria-label={`${item.label} settings`} className="flex flex-col gap-0.5">
              {APP_SECTIONS.map((section) => (
                <li key={section.id}>
                  <SelectableRow
                    selected={appSection === section.id}
                    ariaCurrent={appSection === section.id}
                    onClick={() => onSelect({ scope: 'app', section: section.id })}
                    className="items-center py-1 pl-8 pr-2 text-sm"
                  >
                    {section.label}
                  </SelectableRow>
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    })}
  </nav>
);
