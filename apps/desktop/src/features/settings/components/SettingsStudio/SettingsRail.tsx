import { PANE_RHYTHM, SelectableRow } from '@goodboy/ui';
import { Boxes, Settings, Wrench } from 'lucide-react';
import type { SettingsStudioScope } from './types';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly scope: SettingsStudioScope;
  readonly workspaceName: string | null;
  readonly hasWorkspace: boolean;
  readonly onSelect: (params: { readonly scope: SettingsStudioScope }) => void;
};

const ITEMS = [
  { scope: 'app', label: 'App', icon: Settings, needsWorkspace: false },
  { scope: 'workspace', label: 'Workspace', icon: Wrench, needsWorkspace: true },
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

export const SettingsRail = ({ scope, workspaceName, hasWorkspace, onSelect }: Props) => (
  <nav aria-label="Settings scopes" className={`flex flex-col gap-1 ${PANE_RHYTHM.navRail.body}`}>
    {ITEMS.filter((item) => hasWorkspace || !item.needsWorkspace).map((item) => {
      const Icon = item.icon;
      const subtitle = item.scope === 'workspace' ? workspaceName : null;
      return (
        <SelectableRow
          key={item.scope}
          selected={scope === item.scope}
          ariaCurrent={scope === item.scope}
          onClick={() => onSelect({ scope: item.scope })}
          className={`items-center gap-2.5 ${PANE_RHYTHM.navRail.row}`}
        >
          <Icon size={ICON_SIZE.control} aria-hidden className="shrink-0" />
          <span className="flex min-w-0 flex-col">
            <span className="text-sm font-medium">{item.label}</span>
            {subtitle === null ? null : (
              <span className="truncate text-2xs text-muted-foreground">{subtitle}</span>
            )}
          </span>
        </SelectableRow>
      );
    })}
  </nav>
);
