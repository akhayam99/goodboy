import { PANE_RHYTHM, cn } from '@goodboy/ui';
import type { SettingsPageScope, SettingsScopeChange } from '../../settingsFocus';
import type { SettingsGroup } from './settingsDirectory';
import { MovedToConnectionsRow } from './MovedToConnectionsRow';
import { SettingsRailPageGroup } from './SettingsRailPageGroup';
import { SettingsRailPlaceholder } from './SettingsRailPlaceholder';

type Props = {
  readonly pageKey: string | null;
  readonly groups: ReadonlyArray<SettingsGroup>;
  readonly workspaceName: string | null;
  readonly onSelect: (params: SettingsScopeChange) => void;
};

type GroupParams = {
  readonly groups: ReadonlyArray<SettingsGroup>;
  readonly scope: SettingsPageScope;
};

const groupOf = ({ groups, scope }: GroupParams): SettingsGroup | undefined =>
  groups.find((group) => group.scope === scope);

export const SettingsRail = ({ pageKey, groups, workspaceName, onSelect }: Props) => {
  const app = groupOf({ groups, scope: 'app' });
  const workspace = groupOf({ groups, scope: 'workspace' });

  return (
    <nav
      aria-label="Settings scopes"
      className={cn('flex flex-col gap-3', PANE_RHYTHM.navRail.body)}
    >
      {app === undefined ? null : (
        <SettingsRailPageGroup group={app} pageKey={pageKey} onSelect={onSelect} />
      )}
      {workspace === undefined || workspaceName === null ? (
        <SettingsRailPlaceholder
          scope="workspace"
          label="This workspace"
          line="Open a workspace to see its settings."
        />
      ) : (
        <SettingsRailPageGroup group={workspace} pageKey={pageKey} onSelect={onSelect} />
      )}
      <MovedToConnectionsRow />
    </nav>
  );
};
