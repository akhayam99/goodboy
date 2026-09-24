import { PANE_RHYTHM, Reveal, StatusRailItem, cn } from '@goodboy/ui';
import type { SettingsScopeChange, SettingsStudioScope } from './types';
import { APP_SECTIONS, type AppSection } from './appSections';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useAppStore } from '../../../../store';
import { selectProviderAttention } from '../../../../store/slices/providers/selectProviderAttention';

export type NestedScope = 'providers' | 'tools';

type Props = {
  readonly scope: SettingsStudioScope;
  readonly appSection: AppSection;
  readonly workspaceName: string | null;
  readonly hasWorkspace: boolean;
  readonly nestedSlot: Readonly<Record<NestedScope, (element: HTMLDivElement | null) => void>>;
  readonly onNestedClosed: (params: { readonly scope: NestedScope }) => void;
  readonly onSelect: (params: SettingsScopeChange) => void;
};

const SCOPE_ITEMS = [
  { scope: 'workspace', label: 'Workspace', icon: CONCEPT_ICONS.workspace, needsWorkspace: true },
  {
    scope: 'providers',
    label: 'Providers & models',
    icon: CONCEPT_ICONS.providers,
    needsWorkspace: false,
  },
  { scope: 'tools', label: 'Tools', icon: CONCEPT_ICONS.integrations, needsWorkspace: true },
] as const satisfies ReadonlyArray<{
  scope: Exclude<SettingsStudioScope, 'app'>;
  label: string;
  icon: (typeof CONCEPT_ICONS)[keyof typeof CONCEPT_ICONS];
  needsWorkspace: boolean;
}>;

const DANGER_ROW = 'text-danger hover:text-danger data-[selected=true]:text-danger';

export const isNestedScope = (scope: SettingsStudioScope): scope is NestedScope =>
  scope === 'providers' || scope === 'tools';

export const settingsScopeAvailable = ({
  scope,
  hasWorkspace,
}: {
  readonly scope: SettingsStudioScope;
  readonly hasWorkspace: boolean;
}): boolean =>
  scope === 'app' ||
  hasWorkspace ||
  SCOPE_ITEMS.some((item) => item.scope === scope && !item.needsWorkspace);

export const SettingsRail = ({
  scope,
  appSection,
  workspaceName,
  hasWorkspace,
  nestedSlot,
  onNestedClosed,
  onSelect,
}: Props) => {
  const providerAttention = useAppStore((state) => selectProviderAttention({ state }));
  const hasUpdate = useAppStore((state) => state.updaterStatus === 'available');

  return (
    <nav aria-label="Settings scopes" className={`flex flex-col gap-3 ${PANE_RHYTHM.navRail.body}`}>
      <div className="flex flex-col gap-0.5">
        <StatusRailItem
          icon={<CONCEPT_ICONS.settings size={ICON_SIZE.control} />}
          label="App"
          selected={false}
          onClick={() => onSelect({ scope: 'app' })}
          className={cn(scope === 'app' && 'text-foreground')}
        />
        <ul aria-label="App settings" className="flex flex-col gap-0.5">
          {APP_SECTIONS.map((section) => {
            const Icon = CONCEPT_ICONS[section.concept];
            const isGeneralUpdate = section.id === 'general' && hasUpdate;
            return (
              <li key={section.id}>
                <StatusRailItem
                  icon={<Icon size={ICON_SIZE.row} />}
                  label={section.label}
                  density="compact"
                  tone={isGeneralUpdate ? 'info' : undefined}
                  statusLabel={isGeneralUpdate ? 'Update available' : undefined}
                  selected={scope === 'app' && appSection === section.id}
                  onClick={() => onSelect({ scope: 'app', section: section.id })}
                  className={cn(section.id === 'danger' && DANGER_ROW)}
                />
              </li>
            );
          })}
        </ul>
      </div>
      <div className="flex flex-col gap-0.5">
        {SCOPE_ITEMS.filter((item) => hasWorkspace || !item.needsWorkspace).map((item) => {
          const Icon = item.icon;
          const isActive = scope === item.scope;
          const nested = isNestedScope(item.scope) ? item.scope : null;
          const attention = item.scope === 'providers' ? providerAttention : null;
          return (
            <div key={item.scope} className="flex flex-col gap-0.5">
              <StatusRailItem
                icon={<Icon size={ICON_SIZE.control} />}
                label={item.label}
                subtitle={
                  item.scope === 'workspace'
                    ? (workspaceName ?? undefined)
                    : (attention ?? undefined)
                }
                tone={attention === null ? undefined : 'warning'}
                selected={isActive && nested === null}
                onClick={() => onSelect({ scope: item.scope })}
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
};
