import { useState } from 'react';
import { Button, FormActions, formatError } from '@goodboy/ui';
import { useAppStore } from '../../../store';
import { useToolConnections } from '../../integrations/useToolConnections';
import type { WizardContext } from './useOnboardingWizard';
import { useProjectRemote } from './useProjectRemote';
import { hostFromRemote } from './hostFromRemote';
import { handOffFirstSession, startFirstScout } from './startFirstSession';
import { wizardActions, type WizardCtaAction } from './wizardCta';
import type { WizardNav, WizardStepId } from './wizardSteps';
import { WelcomeStep } from './steps/WelcomeStep';
import { ProvidersStep } from './steps/ProvidersStep';
import type { WorkspaceId } from '@goodboy/types';
import { ProjectStep } from './steps/ProjectStep';
import { CodeHostStep } from './steps/CodeHostStep';
import { TasksStep } from './steps/TasksStep';
import { FirstSessionStep, type FirstSessionChoice } from './steps/FirstSessionStep';

type Props = {
  readonly step: WizardStepId;
  readonly nav: WizardNav;
  readonly wizard: WizardContext;
};

type StepOutcome = 'next' | 'stay';

type CreatedParams = {
  readonly workspaceId: WorkspaceId;
};

export const WizardStepBody = ({ step, nav, wizard }: Props) => {
  const { providersConnected, workspace, projects } = wizard;
  const setCurrentWorkspace = useAppStore((s) => s.setCurrentWorkspace);
  const [isBusy, setIsBusy] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);
  const workspaceId = workspace?.id ?? null;
  const tools = useToolConnections({ workspaceId });
  const firstRepo = projects.filter((project) => project.kind === 'repo')[0] ?? null;
  const originHost = hostFromRemote(useProjectRemote({ project: firstRepo }));

  const isCodeHostConnected =
    tools.connected.github || tools.connected.gitlab || tools.connected.bitbucket;
  const issueHost = tools.connected.github ? 'github' : tools.connected.gitlab ? 'gitlab' : null;
  const isTaskSourceConnected =
    issueHost !== null || tools.connected.linear || tools.connected.jira;
  const isLocked = isBusy || nav.isLocked;

  const runStepAction = (action: () => Promise<StepOutcome>) => {
    setIsBusy(true);
    nav.setBusy(true);
    setStepError(null);
    void action()
      .then((outcome) => {
        if (outcome === 'next') {
          nav.goNext();
        }
      })
      .catch((error: unknown) => {
        setStepError(formatError(error));
      })
      .finally(() => {
        setIsBusy(false);
        nav.setBusy(false);
      });
  };

  const onWorkspaceCreated = ({ workspaceId: created }: CreatedParams) =>
    runStepAction(async () => {
      await setCurrentWorkspace(created);
      return 'next';
    });

  const startScout = (prompt: string) => {
    if (workspace === null) {
      return;
    }
    runStepAction(async () => {
      await startFirstScout({
        workspaceId: workspace.id,
        projectId: projects[0]?.id ?? null,
        prompt,
      });
      nav.finish();
      return 'stay';
    });
  };

  const handOff = (choice: Exclude<FirstSessionChoice, 'agent'>) => {
    if (workspace === null) {
      return;
    }
    nav.finish({
      after: () =>
        handOffFirstSession({
          workspaceId: workspace.id,
          projectId: projects[0]?.id ?? null,
          choice,
        }),
    });
  };

  const actions = wizardActions({
    step,
    providersConnected,
    codeHostConnected: isCodeHostConnected,
    taskSourceConnected: isTaskSourceConnected,
    isLastStep: nav.isLast,
    busy: isLocked,
  });
  const CTA_HANDLERS: Readonly<Record<WizardCtaAction, () => void>> = {
    next: nav.goNext,
    finish: () => nav.finish(),
  };
  const toTools = nav.mode === 'single' ? null : () => nav.goTo({ step: 'tools' });

  const body = (() => {
    switch (step) {
      case 'welcome':
        return <WelcomeStep />;
      case 'agents':
        return <ProvidersStep />;
      case 'workspace':
        return <ProjectStep onCreated={onWorkspaceCreated} onBack={nav.goBack ?? undefined} />;
      case 'tools':
        return workspaceId === null ? null : (
          <div className="flex flex-col gap-8">
            {firstRepo === null && projects.length > 0 ? null : (
              <CodeHostStep
                workspaceId={workspaceId}
                originHost={originHost}
                projectName={firstRepo?.name ?? null}
                connected={tools.connected}
                githubIdentity={tools.githubIdentity}
              />
            )}
            <TasksStep
              workspaceId={workspaceId}
              issueHost={issueHost}
              preferredHost={originHost}
              connected={tools.connected}
              onBackToCodeHost={null}
            />
          </div>
        );
      case 'first-session':
        return (
          <FirstSessionStep
            projectName={projects[0]?.name ?? 'this project'}
            hasIssueSource={isTaskSourceConnected}
            busy={isBusy}
            onStartScout={startScout}
            onHandOff={handOff}
            onBackToCodeHost={toTools}
            onConnectTaskManager={toTools}
          />
        );
      default: {
        const exhaustive: never = step;
        return exhaustive;
      }
    }
  })();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        {body}
        {stepError !== null ? (
          <p role="alert" className="text-label text-danger">
            {stepError}
          </p>
        ) : null}
      </div>
      {step === 'workspace' ? null : (
        <FormActions reason={actions.hint}>
          {nav.goBack === null ? null : (
            <Button
              size="md"
              variant="ghost"
              onClick={nav.goBack}
              disabled={isLocked}
              className="text-muted-foreground"
            >
              Back
            </Button>
          )}
          {actions.skip !== null && (
            <Button
              size="md"
              variant="ghost"
              disabled={actions.skip.disabled}
              onClick={CTA_HANDLERS[actions.skip.action]}
              className="text-muted-foreground"
            >
              {actions.skip.label}
            </Button>
          )}
          {actions.primary !== null && (
            <Button
              size="md"
              variant="primary"
              disabled={actions.primary.disabled}
              onClick={CTA_HANDLERS[actions.primary.action]}
            >
              {actions.primary.label}
            </Button>
          )}
        </FormActions>
      )}
    </div>
  );
};
