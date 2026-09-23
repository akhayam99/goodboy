import { ScrollFade, StudioRailLayout } from '@goodboy/ui';
import type { Workspace } from '@goodboy/types';
import { ToolSettingsScope } from '../../../integrations/components/ToolSettingsScope';
import { ProviderSettingsScope } from '../../../providers/components/ProviderStudio';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { AppScopePanel } from './AppScopePanel';
import { SettingsRail } from './SettingsRail';
import type { SettingsFocus, SettingsStudioScope } from './types';
import { WorkspaceScopePanel } from './WorkspaceScopePanel';

type Props = {
  readonly currentWorkspace: Workspace | null;
  readonly focus: SettingsFocus;
  readonly onScopeChange: (params: { readonly scope: SettingsStudioScope }) => void;
  readonly onClose: () => void;
};

export const SettingsStudio = ({ currentWorkspace, focus, onScopeChange, onClose }: Props) => {
  const availableScope = currentWorkspace === null && focus.scope !== 'app' ? 'app' : focus.scope;

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
                workspaceName={currentWorkspace?.name ?? null}
                onSelect={onScopeChange}
              />
            </ScrollFade>
          }
          detail={
            availableScope === 'app' ? (
              <AppScopePanel initialSection={focus.section} requestClose={requestClose} />
            ) : availableScope === 'workspace' && currentWorkspace !== null ? (
              <WorkspaceScopePanel
                workspaceId={currentWorkspace.id}
                initialSection={focus.section}
                requestClose={requestClose}
              />
            ) : availableScope === 'providers' && currentWorkspace !== null ? (
              <ProviderSettingsScope
                workspaceId={currentWorkspace.id}
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
