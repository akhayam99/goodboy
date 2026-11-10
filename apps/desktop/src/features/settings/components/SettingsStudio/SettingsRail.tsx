import { useState } from 'react';
import { PANE_RHYTHM, cn } from '@goodboy/ui';
import type { SettingsPageScope, SettingsScopeChange } from '../../settingsFocus';
import { foldOfPageKey, type SettingsGroup } from './settingsDirectory';
import { SettingsRailFold } from './SettingsRailFold';
import { SettingsRailPageGroup } from './SettingsRailPageGroup';
import { SettingsRailPlaceholder } from './SettingsRailPlaceholder';
import type { NestedScope } from './settingsScopes';

type Props = {
  readonly pageKey: string | null;
  readonly groups: ReadonlyArray<SettingsGroup>;
  readonly workspaceName: string | null;
  readonly onSelect: (params: SettingsScopeChange) => void;
};

type Folds = Readonly<Record<NestedScope, boolean>>;

const CLOSED: Folds = { providers: false, tools: false };

type OpenedParams = {
  readonly folds: Folds;
  readonly groups: ReadonlyArray<SettingsGroup>;
  readonly pageKey: string | null;
};

const opened = ({ folds, groups, pageKey }: OpenedParams): Folds => {
  const fold = foldOfPageKey({ groups, pageKey });
  return fold !== null && !folds[fold] ? { ...folds, [fold]: true } : folds;
};

type GroupParams = {
  readonly groups: ReadonlyArray<SettingsGroup>;
  readonly scope: SettingsPageScope;
};

const groupOf = ({ groups, scope }: GroupParams): SettingsGroup | undefined =>
  groups.find((group) => group.scope === scope);

export const SettingsRail = ({ pageKey, groups, workspaceName, onSelect }: Props) => {
  const [folds, setFolds] = useState<Folds>(() => opened({ folds: CLOSED, groups, pageKey }));
  const [seenPageKey, setSeenPageKey] = useState(pageKey);
  if (seenPageKey !== pageKey) {
    setSeenPageKey(pageKey);
    setFolds(opened({ folds, groups, pageKey }));
  }

  const app = groupOf({ groups, scope: 'app' });
  const workspace = groupOf({ groups, scope: 'workspace' });
  const providers = groupOf({ groups, scope: 'providers' });
  const tools = groupOf({ groups, scope: 'tools' });

  return (
    <nav
      aria-label="Settings scopes"
      className={cn('flex flex-col gap-3', PANE_RHYTHM.navRail.body)}
    >
      {app === undefined ? null : (
        <SettingsRailPageGroup
          group={app}
          label={app.label}
          pageKey={pageKey}
          onSelect={onSelect}
        />
      )}
      {providers === undefined ? null : (
        <SettingsRailFold
          group={providers}
          isOpen={folds.providers}
          pageKey={pageKey}
          onToggle={() => setFolds({ ...folds, providers: !folds.providers })}
          onSelect={onSelect}
        />
      )}
      {workspace === undefined || workspaceName === null ? (
        <>
          <SettingsRailPlaceholder
            scope="workspace"
            label="This workspace"
            line="Open a workspace to see its settings."
          />
          <SettingsRailPlaceholder
            scope="tools"
            label="Integrations"
            line="Integrations belong to a workspace."
          />
        </>
      ) : (
        <SettingsRailPageGroup
          group={workspace}
          label={`${workspace.label} · ${workspaceName}`}
          pageKey={pageKey}
          onSelect={onSelect}
        >
          {tools === undefined ? null : (
            <SettingsRailFold
              group={tools}
              isOpen={folds.tools}
              pageKey={pageKey}
              onToggle={() => setFolds({ ...folds, tools: !folds.tools })}
              onSelect={onSelect}
            />
          )}
        </SettingsRailPageGroup>
      )}
    </nav>
  );
};
