import { PANE_RHYTHM, Reveal, StatusRailItem, cn } from '@goodboy/ui';
import type { SettingsPageScope, SettingsScopeChange } from '../../settingsFocus';
import type { AppSection } from './appSections';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { SettingsGroup } from './settingsDirectory';
import { SettingsRailAppGroup } from './SettingsRailAppGroup';
import { isNestedScope, type NestedScope } from './settingsScopes';

type Props = {
  readonly scope: SettingsPageScope;
  readonly appSection: AppSection;
  readonly groups: ReadonlyArray<SettingsGroup>;
  readonly nestedSlot: Readonly<Record<NestedScope, (element: HTMLDivElement | null) => void>>;
  readonly onNestedClosed: (params: { readonly scope: NestedScope }) => void;
  readonly onSelect: (params: SettingsScopeChange) => void;
};

export const SettingsRail = ({
  scope,
  appSection,
  groups,
  nestedSlot,
  onNestedClosed,
  onSelect,
}: Props) => (
  <nav aria-label="Settings scopes" className={`flex flex-col gap-3 ${PANE_RHYTHM.navRail.body}`}>
    {groups
      .filter((group) => group.scope === 'app')
      .map((group) => (
        <SettingsRailAppGroup
          key={group.scope}
          group={group}
          scope={scope}
          appSection={appSection}
          onSelect={onSelect}
        />
      ))}
    <div className="flex flex-col gap-0.5">
      {groups
        .filter((group) => group.scope !== 'app')
        .map((group) => {
          const Icon = CONCEPT_ICONS[group.concept];
          const isActive = scope === group.scope;
          const nested = isNestedScope(group.scope) ? group.scope : null;
          return (
            <div
              key={group.scope}
              data-settings-page={nested === null ? group.scope : undefined}
              data-settings-group={group.scope}
              className="flex flex-col gap-0.5"
            >
              <StatusRailItem
                icon={<Icon size={ICON_SIZE.control} />}
                label={group.label}
                subtitle={group.subtitle}
                tone={group.tone}
                selected={isActive && nested === null}
                onClick={() => onSelect({ scope: group.scope })}
                className={cn(isActive && 'text-foreground')}
              />
              {nested === null ? null : (
                <Reveal open={isActive} onClosed={() => onNestedClosed({ scope: nested })}>
                  <div ref={nestedSlot[nested]} />
                </Reveal>
              )}
            </div>
          );
        })}
    </div>
  </nav>
);
