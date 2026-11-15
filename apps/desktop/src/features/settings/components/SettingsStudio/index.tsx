import { useEffect, useEffectEvent, useMemo, type ReactNode } from 'react';
import type { StudioRailPlacement } from '@goodboy/ui';
import type { Workspace } from '@goodboy/types';
import { DefaultsPanel } from '../../../providers/components/ProviderStudio/DefaultsPanel';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { StudioDetail } from '../../../../shared/components/StudioShell/StudioDetail';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { useAppStore } from '../../../../store';
import { AppScopePanel } from './AppScopePanel';
import { SettingsScopesLayout } from './SettingsScopesLayout';
import { settingsScopeAvailable } from './settingsScopes';
import { UPDATES_SECTION_ID, appSectionOf } from './appSections';
import type { SettingsFocus, SettingsPageScope, SettingsScopeChange } from '../../settingsFocus';
import { WorkspaceScopePanel } from './WorkspaceScopePanel';
import { useSettingsStatus } from '../../hooks/useSettingsStatus';
import { useIsIphonePaired } from '../../hooks/useIsIphonePaired';
import { MODELS_PAGE_SECTION } from '../../isModelsPage';
import { settingsDirectory, settingsPageKey } from './settingsDirectory';
import { pageFocusOf, resolveSettingsFocus } from './resolveSettingsFocus';
import { workspacePageOf } from './workspacePages';

type Props = {
  readonly currentWorkspace: Workspace | null;
  readonly focus: SettingsFocus;
  readonly onScopeChange: (params: SettingsScopeChange) => void;
  readonly onClose: () => void;
  readonly railPlacement?: StudioRailPlacement;
};

type SamePageParams = {
  readonly left: SettingsFocus;
  readonly right: SettingsFocus;
};

const isSamePage = ({ left, right }: SamePageParams): boolean =>
  left.scope === right.scope && left.section === right.section;

const pageScopeOf = ({
  focus,
  hasWorkspace,
}: {
  readonly focus: SettingsFocus;
  readonly hasWorkspace: boolean;
}): SettingsPageScope => {
  if (focus.scope === 'home') {
    return 'app';
  }
  return settingsScopeAvailable({ scope: focus.scope, hasWorkspace }) ? focus.scope : 'app';
};

export const SettingsStudio = ({
  currentWorkspace,
  focus: requestedFocus,
  onScopeChange,
  onClose,
  railPlacement = 'chrome',
}: Props) => {
  const hasWorkspace = currentWorkspace !== null;
  const workspaceId = currentWorkspace?.id ?? null;
  const workspaceName = currentWorkspace?.name ?? null;
  const status = useSettingsStatus({ workspaceId });
  const isIphonePaired = useIsIphonePaired();
  const groups = useMemo(
    () => settingsDirectory({ status, workspaceName, isIphonePaired }),
    [status, workspaceName, isIphonePaired],
  );
  const lastFocus = useAppStore((state) => state.lastSettingsFocus);
  const rememberFocus = useAppStore((state) => state.rememberSettingsFocus);
  const focus = resolveSettingsFocus({ focus: requestedFocus, last: lastFocus, groups });
  const isRedirect = !isSamePage({ left: focus, right: requestedFocus });
  const availableScope = pageScopeOf({ focus, hasWorkspace });
  const pageKey = settingsPageKey({ scope: availableScope, section: focus.section });

  const redirect = useEffectEvent(() => onScopeChange(focus));
  const rememberPage = useEffectEvent(() =>
    rememberFocus(pageFocusOf({ scope: availableScope, focus })),
  );

  useEffect(() => {
    if (isRedirect) {
      redirect();
    }
  }, [isRedirect]);

  useEffect(() => {
    rememberPage();
  }, [pageKey]);

  const workspace = availableScope === 'workspace' ? currentWorkspace : null;
  const focusSection = focus.section === MODELS_PAGE_SECTION ? undefined : focus.section;

  const renderDetail = (requestClose: () => void): ReactNode => {
    if (workspace !== null && workspacePageOf({ section: focus.section }) === MODELS_PAGE_SECTION) {
      return (
        <DefaultsPanel
          workspaceId={workspace.id}
          scopeLabel={workspace.name}
          {...(focusSection !== undefined && { focusSection })}
        />
      );
    }
    if (workspace !== null) {
      return (
        <WorkspaceScopePanel
          key={`workspace:${focus.flow ?? ''}`}
          workspaceId={workspace.id}
          section={focus.section}
          initialFlow={focus.flow}
          requestClose={requestClose}
        />
      );
    }
    return (
      <AppScopePanel
        section={appSectionOf({ section: focus.section })}
        isUpdatesFocused={focus.section === UPDATES_SECTION_ID}
      />
    );
  };

  return (
    <StudioShell
      icon={CONCEPT_ICONS.settings}
      tone={CONCEPT_TONE.settings}
      title="Settings"
      onClose={onClose}
    >
      {(requestClose) => (
        <div className="relative flex min-h-0 min-w-0 flex-1">
          <SettingsScopesLayout
            pageKey={pageKey}
            groups={groups}
            workspaceName={workspaceName}
            onScopeChange={onScopeChange}
            placement={railPlacement}
            detail={
              <StudioDetail>
                <div data-settings-detail="" className="h-full min-h-0 min-w-0">
                  {renderDetail(requestClose)}
                </div>
              </StudioDetail>
            }
          />
        </div>
      )}
    </StudioShell>
  );
};
