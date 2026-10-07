import { PANE_RHYTHM, Reveal, cn } from '@goodboy/ui';
import type { SettingsPageScope, SettingsScopeChange } from '../../settingsFocus';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { SettingsNavRow } from '../../../../shared/components/SettingsNavRow';
import type { SettingsGroup } from './settingsDirectory';
import { SettingsRailPageGroup } from './SettingsRailPageGroup';
import { isNestedScope, type NestedScope } from './settingsScopes';

type Props = {
  readonly scope: SettingsPageScope;
  readonly pageKey: string | null;
  readonly groups: ReadonlyArray<SettingsGroup>;
  readonly nestedSlot: Readonly<Record<NestedScope, (element: HTMLDivElement | null) => void>>;
  readonly onNestedClosed: (params: { readonly scope: NestedScope }) => void;
  readonly onSelect: (params: SettingsScopeChange) => void;
  readonly isInColumn?: boolean;
};

export const SettingsRail = ({
  scope,
  pageKey,
  groups,
  nestedSlot,
  onNestedClosed,
  onSelect,
  isInColumn = false,
}: Props) => (
  <nav
    aria-label="Settings scopes"
    className={cn('flex flex-col gap-3', isInColumn ? 'py-1' : PANE_RHYTHM.navRail.body)}
  >
    {groups
      .filter((group) => !isNestedScope(group.scope))
      .map((group) => (
        <SettingsRailPageGroup
          key={group.scope}
          group={group}
          isCurrentGroup={scope === group.scope}
          pageKey={pageKey}
          onSelect={onSelect}
        />
      ))}
    <div className="flex flex-col gap-0.5">
      {groups.map((group) => {
        if (!isNestedScope(group.scope)) {
          return null;
        }
        const nested = group.scope;
        const Icon = CONCEPT_ICONS[group.concept];
        const isActive = scope === nested;
        return (
          <div key={nested} data-settings-group={nested} className="flex flex-col gap-0.5">
            <SettingsNavRow
              level="group"
              icon={<Icon size={ICON_SIZE.control} />}
              label={group.label}
              isActiveGroup={isActive}
              status={
                group.tone === undefined
                  ? null
                  : { tone: group.tone, label: group.subtitle ?? null }
              }
              onClick={() => onSelect({ scope: nested })}
            />
            <Reveal open={isActive} onClosed={() => onNestedClosed({ scope: nested })}>
              <div ref={nestedSlot[nested]} />
            </Reveal>
          </div>
        );
      })}
    </div>
  </nav>
);
