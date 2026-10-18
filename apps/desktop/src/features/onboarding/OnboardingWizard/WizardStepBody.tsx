import { useState } from 'react';
import { formatError } from '@goodboy/ui';
import type { ProviderId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { openSettings } from '../../settings/openSettings';
import { applyDefaultAgent } from './defaultAgent';
import { readyAgents } from './readyAgents';
import { handOffFirstSession, startFirstScout } from './startFirstSession';
import type { WizardContext } from './useOnboardingWizard';
import type { WizardNav, WizardStepId } from './wizardSteps';
import { AgentsStep } from './steps/AgentsStep';
import { FirstSessionStep } from './steps/FirstSessionStep';
import { ToolsStep } from './steps/ToolsStep';
import { WelcomeStep } from './steps/WelcomeStep';
import { WorkspaceStep } from './steps/WorkspaceStep';

type Props = {
  readonly step: WizardStepId;
  readonly nav: WizardNav;
  readonly wizard: WizardContext;
};

type CreatedParams = {
  readonly workspaceId: WorkspaceId;
};

const FALLBACK_AGENT: ProviderId = 'anthropic';

export const WizardStepBody = ({ step, nav, wizard }: Props) => {
  const { workspace, projects, mode } = wizard;
  const setCurrentWorkspace = useAppStore((state) => state.setCurrentWorkspace);
  const workspaceAgent = useAppStore((state) =>
    workspace === null ? null : (state.workspaceOverrides[workspace.id]?.defaultProviderId ?? null),
  );
  const firstReady = useAppStore((state) => readyAgents({ providers: state.providers })[0] ?? null);
  const [stepError, setStepError] = useState<string | null>(null);
  const folder = projects[0] ?? null;
  const toTools = mode === 'single' ? null : () => nav.goTo({ step: 'tools' });

  const onWorkspaceCreated = ({ workspaceId }: CreatedParams) => {
    nav.setBusy(true);
    setStepError(null);
    void setCurrentWorkspace(workspaceId)
      .then(() => applyDefaultAgent({ workspaceId }))
      .then(() => nav.goNext())
      .catch((error: unknown) => setStepError(formatError(error)))
      .finally(() => nav.setBusy(false));
  };

  const onOpenSettings = () => nav.later({ after: () => openSettings({ scope: 'tools' }) });

  switch (step) {
    case 'welcome':
      return <WelcomeStep isLocked={nav.isLocked} onStart={nav.goNext} />;
    case 'agents':
      return (
        <AgentsStep
          mode={mode}
          isLocked={nav.isLocked}
          onBack={nav.goBack}
          onDone={nav.goNext}
          setBusy={nav.setBusy}
        />
      );
    case 'workspace':
      return (
        <div className="flex flex-col gap-4">
          <WorkspaceStep onCreated={onWorkspaceCreated} onBack={nav.goBack} />
          {stepError === null ? null : (
            <p role="alert" className="text-meta text-danger">
              {stepError}
            </p>
          )}
        </div>
      );
    case 'tools':
      return workspace === null ? null : (
        <ToolsStep
          workspaceId={workspace.id}
          workspaceName={workspace.name}
          projects={projects}
          mode={mode}
          isLocked={nav.isLocked}
          onBack={nav.goBack}
          onContinue={mode === 'single' ? () => nav.finish() : nav.goNext}
          onOpenSettings={onOpenSettings}
        />
      );
    case 'first-session':
      return workspace === null ? null : (
        <FirstSessionStep
          workspaceId={workspace.id}
          folder={folder}
          agent={workspaceAgent ?? firstReady ?? FALLBACK_AGENT}
          mode={mode}
          isLocked={nav.isLocked}
          onBack={nav.goBack}
          onSkip={() => nav.finish()}
          onStart={async ({ prompt }) => {
            nav.setBusy(true);
            try {
              await startFirstScout({
                workspaceId: workspace.id,
                projectId: folder?.id ?? null,
                prompt,
              });
              nav.finish();
            } finally {
              nav.setBusy(false);
            }
          }}
          onDraft={({ issue }) =>
            nav.finish({
              after: () =>
                handOffFirstSession({
                  workspaceId: workspace.id,
                  projectId: folder?.id ?? null,
                  issue,
                }),
            })
          }
          onOpenTools={toTools}
        />
      );
    default: {
      const exhaustive: never = step;
      return exhaustive;
    }
  }
};
