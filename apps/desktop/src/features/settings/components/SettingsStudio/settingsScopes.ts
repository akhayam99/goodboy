import type { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import type { SettingsPageScope } from '../../settingsFocus';

export type NestedScope = 'providers' | 'tools';

export const SCOPE_ITEMS = [
  { scope: 'workspace', label: 'Workspace', concept: 'workspace', needsWorkspace: true },
  {
    scope: 'providers',
    label: 'Providers & models',
    concept: 'providers',
    needsWorkspace: false,
  },
  { scope: 'tools', label: 'Integrations', concept: 'integrations', needsWorkspace: true },
] as const satisfies ReadonlyArray<{
  readonly scope: Exclude<SettingsPageScope, 'app'>;
  readonly label: string;
  readonly concept: keyof typeof CONCEPT_ICONS;
  readonly needsWorkspace: boolean;
}>;

export const isNestedScope = (scope: SettingsPageScope): scope is NestedScope =>
  scope === 'providers' || scope === 'tools';

export const settingsScopeAvailable = ({
  scope,
  hasWorkspace,
}: {
  readonly scope: SettingsPageScope;
  readonly hasWorkspace: boolean;
}): boolean =>
  scope === 'app' ||
  hasWorkspace ||
  SCOPE_ITEMS.some((item) => item.scope === scope && !item.needsWorkspace);
