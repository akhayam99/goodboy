import { useState } from 'react';
import { PANE_RHYTHM, cn } from '@goodboy/ui';
import type { SettingsPageScope, SettingsScopeChange } from '../../settingsFocus';
import type { SettingsGroup } from './settingsDirectory';
import { SettingsRailFold } from './SettingsRailFold';
import { SettingsRailPageGroup } from './SettingsRailPageGroup';
import { SettingsRailPlaceholder } from './SettingsRailPlaceholder';
import { isNestedScope, type NestedScope } from './settingsScopes';

type Props = {
  readonly scope: SettingsPageScope;
  readonly pageKey: string | null;
  readonly groups: ReadonlyArray<SettingsGroup>;
  readonly workspaceName: string | null;
  readonly onSelect: (params: SettingsScopeChange) => void;
  readonly isInColumn?: boolean;
};

type Folds = Readonly<Record<NestedScope, boolean>>;

const CLOSED: Folds = { providers: false, tools: false };

type OpenedParams = {
  readonly folds: Folds;
  readonly scope: SettingsPageScope;
};

const opened = ({ folds, scope }: OpenedParams): Folds =>
  isNestedScope(scope) && !folds[scope] ? { ...folds, [scope]: true } : folds;

type GroupParams = {
  readonly groups: ReadonlyArray<SettingsGroup>;
  readonly scope: SettingsPageScope;
};

const groupOf = ({ groups, scope }: GroupParams): SettingsGroup | undefined =>
  groups.find((group) => group.scope === scope);

export const SettingsRail = ({
  scope,
  pageKey,
  groups,
  workspaceName,
  onSelect,
  isInColumn = false,
}: Props) => {
  const [folds, setFolds] = useState<Folds>(() => opened({ folds: CLOSED, scope }));
  const [seenScope, setSeenScope] = useState(scope);
  if (seenScope !== scope) {
    setSeenScope(scope);
    setFolds(opened({ folds, scope }));
  }

  const app = groupOf({ groups, scope: 'app' });
  const workspace = groupOf({ groups, scope: 'workspace' });
  const providers = groupOf({ groups, scope: 'providers' });
  const tools = groupOf({ groups, scope: 'tools' });

  return (
    <nav
      aria-label="Settings scopes"
      className={cn('flex flex-col gap-3', isInColumn ? 'py-1' : PANE_RHYTHM.navRail.body)}
    >
      {app === undefined ? null : (
        <SettingsRailPageGroup
          group={app}
          label={app.label}
          isCurrentGroup={scope === 'app'}
          pageKey={pageKey}
          onSelect={onSelect}
        />
      )}
      {workspace === undefined || workspaceName === null ? (
        <SettingsRailPlaceholder
          scope="workspace"
          label="Workspace"
          line="Open a workspace to see its settings."
        />
      ) : (
        <SettingsRailPageGroup
          group={workspace}
          label={`${workspace.label} · ${workspaceName}`}
          isCurrentGroup={scope === 'workspace'}
          pageKey={pageKey}
          onSelect={onSelect}
        />
      )}
      {providers === undefined ? null : (
        <SettingsRailFold
          group={providers}
          isOpen={folds.providers}
          isCurrentGroup={scope === 'providers'}
          pageKey={pageKey}
          onToggle={() => setFolds({ ...folds, providers: !folds.providers })}
          onSelect={onSelect}
        />
      )}
      {tools === undefined ? (
        <SettingsRailPlaceholder
          scope="tools"
          label="Integrations"
          line="Integrations belong to a workspace."
        />
      ) : (
        <SettingsRailFold
          group={tools}
          isOpen={folds.tools}
          isCurrentGroup={scope === 'tools'}
          pageKey={pageKey}
          onToggle={() => setFolds({ ...folds, tools: !folds.tools })}
          onSelect={onSelect}
        />
      )}
    </nav>
  );
};
