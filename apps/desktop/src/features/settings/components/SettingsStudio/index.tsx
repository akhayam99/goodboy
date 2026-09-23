import { ScrollFade, StudioRailLayout } from '@goodboy/ui';
import type { Workspace } from '@goodboy/types';
import { ToolSettingsScope } from '../../../integrations/components/ToolSettingsScope';
import { ProviderSettingsScope } from '../../../providers/components/ProviderStudio';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { AppScopePanel } from './AppScopePanel';
import { SettingsRail, settingsScopeAvailable } from './SettingsRail';
import { appSectionOf } from './appSections';
import type { SettingsFocus, SettingsScopeChange } from './types';
import { WorkspaceScopePanel } from './WorkspaceScopePanel';

type Props = {
  readonly currentWorkspace: Workspace | null;
  readonly focus: SettingsFocus;
  readonly onScopeChange: (params: SettingsScopeChange) => void;
  readonly onClose: () => void;
};

export const SettingsStudio = ({ currentWorkspace, focus, onScopeChange, onClose }: Props) => {
  const hasWorkspace = currentWorkspace !== null;
  const availableScope = settingsScopeAvailable({ scope: focus.scope, hasWorkspace })
    ? focus.scope
    : 'app';

  return (
    <StudioShell
      icon={CONCEPT_ICONS.settings}
      tone={CONCEPT_TONE.settings}
      title="Settings"
      workspaceName={currentWorkspace?.name ?? 'App settings'}
      closeLabel="close settings"
      onClose={onClose}
    >
      {(requestClose) => (
        <StudioRailLayout
          railLabel="Settings scopes"
          railWidth="narrow"
          rail={
            <ScrollFade className="min-h-0 flex-1" fadeFrom="background">
              <SettingsRail
                scope={availableScope}
                appSection={appSectionOf({ section: focus.section })}
                workspaceName={currentWorkspace?.name ?? null}
                hasWorkspace={hasWorkspace}
                onSelect={onScopeChange}
              />
            </ScrollFade>
          }
          detail={
            availableScope === 'app' ? (
              <AppScopePanel
                section={appSectionOf({ section: focus.section })}
                requestClose={requestClose}
              />
            ) : availableScope === 'workspace' && currentWorkspace !== null ? (
              <WorkspaceScopePanel
                workspaceId={currentWorkspace.id}
                initialSection={focus.section}
                requestClose={requestClose}
              />
            ) : availableScope === 'providers' ? (
              <ProviderSettingsScope
                workspaceId={currentWorkspace?.id ?? null}
                initialFocus={focus.provider}
                initialAction={focus.action}
              />
            ) : availableScope === 'tools' && currentWorkspace !== null ? (
              <ToolSettingsScope
                key={currentWorkspace.id}
                workspaceId={currentWorkspace.id}
                initialFocus={focus.tool}
              />
            ) : null
          }
        />
      )}
    </StudioShell>
  );
};
