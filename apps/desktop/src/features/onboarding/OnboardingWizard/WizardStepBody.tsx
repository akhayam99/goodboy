import { useState } from 'react';
import { formatError } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { openSettings } from '../../settings/openSettings';
import { applyDefaultAgent } from './defaultAgent';
import { handOffFirstSession } from './startFirstSession';
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

export const WizardStepBody = ({ step, nav, wizard }: Props) => {
  const { workspace, projects, mode } = wizard;
  const setCurrentWorkspace = useAppStore((state) => state.setCurrentWorkspace);
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
      return <WorkspaceStep onCreated={onWorkspaceCreated} onBack={nav.goBack} error={stepError} />;
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
          mode={mode}
          isLocked={nav.isLocked}
          onBack={nav.goBack}
          onSkip={() => nav.finish()}
          onStarted={() => nav.finish()}
          onDraft={(target) => nav.finish({ after: () => handOffFirstSession(target) })}
          onOpenTools={toTools}
        />
      );
    default: {
      const exhaustive: never = step;
      return exhaustive;
    }
  }
};
