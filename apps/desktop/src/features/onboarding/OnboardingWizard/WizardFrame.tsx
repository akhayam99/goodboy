import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, FormActions, ScrollFade, cn, formatError } from '@goodboy/ui';
import { useAppStore } from '../../../store';
import type { ProjectAttachConflict } from '../../../store/slices/projects/addProject';
import { scanChildRepos, validateGitRepo } from '../../../shared/lib/repo';
import type { DetectedChildRepos } from '../../../shared/hooks/useChildRepoDetection';
import { useProjectAdoption } from '../../../shared/hooks/useProjectAdoption';
import { useToolConnections } from '../../integrations/useToolConnections';
import { finishWizard } from '../onboarding-store';
import type { OnboardingWizardState } from './useOnboardingWizard';
import { capitalize, folderName, workspaceNameFor } from './folderNames';
import { useStepTransition } from './useStepTransition';
import { useProjectRemote } from './useProjectRemote';
import { StepTransition } from './StepTransition';
import { Stepper } from './Stepper';
import { WizardStepBody } from './WizardStepBody';
import { visibleWizardSteps, type WizardStepId } from './wizardSteps';
import { wizardActions, type WizardCtaAction } from './wizardCta';
import { hostFromRemote } from './hostFromRemote';
import { handOffFirstSession, startFirstScout } from './startFirstSession';
import type { FolderPick } from './steps/ProjectStep';
import type { FirstSessionChoice } from './steps/FirstSessionStep';

const EXIT_MS = 200;

type FrameProps = Omit<OnboardingWizardState, 'open'>;

export const WizardFrame = ({
  mode,
  start,
  providersConnected,
  workspace,
  projectCount,
  projects,
}: FrameProps) => {
  const createWorkspace = useAppStore((s) => s.createWorkspace);
  const renameWorkspace = useAppStore((s) => s.renameWorkspace);
  const setCurrentWorkspace = useAppStore((s) => s.setCurrentWorkspace);
  const addProject = useAppStore((s) => s.addProject);
  const addProjects = useAppStore((s) => s.addProjects);
  const removeProject = useAppStore((s) => s.removeProject);
  const adoptProject = useAppStore((s) => s.adoptProject);
  const previewProjectAdoption = useAppStore((s) => s.previewProjectAdoption);
  const [detection, setDetection] = useState<DetectedChildRepos | null>(null);
  const [conflict, setConflict] = useState<ProjectAttachConflict | null>(null);
  const [workspaceName, setWorkspaceName] = useState('');
  const [busy, setBusy] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const detectedPaths = useMemo(() => detection?.repos.map((repo) => repo.path) ?? [], [detection]);
  const workspaceId = workspace?.id ?? null;
  const adoption = useProjectAdoption({ workspaceId, detectedPaths });
  const tools = useToolConnections({ workspaceId });
  const firstRepo = projects.find((project) => project.kind === 'repo') ?? null;
  const originHost = hostFromRemote(useProjectRemote({ project: firstRepo }));

  const skipsCodeHost = projects.length > 0 && firstRepo === null;
  const steps = visibleWizardSteps({ mode, start, skipsCodeHost });
  const [step, setStep] = useState<WizardStepId>(() => steps[0] ?? 'welcome');
  const transition = useStepTransition({ step, order: steps });

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  useEffect(() => {
    setWorkspaceName(workspace?.name ?? '');
  }, [workspace?.id]);

  const codeHostConnected =
    tools.connected.github || tools.connected.gitlab || tools.connected.bitbucket;
  const issueHost = tools.connected.github ? 'github' : tools.connected.gitlab ? 'gitlab' : null;
  const taskSourceConnected = issueHost !== null || tools.connected.linear || tools.connected.jira;
  const stepIndex = steps.indexOf(step);
  const isFirstStep = stepIndex <= 0;
  const isLastStep = stepIndex === steps.length - 1;
  const isLocked = busy || transition.isTransitioning;

  const goTo = (next: WizardStepId) => {
    if (transition.isTransitioning || !steps.includes(next)) {
      return;
    }
    setStepError(null);
    setStep(next);
  };
  const goNext = () => {
    const next = steps[stepIndex + 1];
    if (next !== undefined) {
      goTo(next);
    }
  };
  const goBack = () => {
    const previous = steps[stepIndex - 1];
    if (previous !== undefined) {
      goTo(previous);
    }
  };
  const close = (after?: () => void) => {
    setClosing(true);
    window.setTimeout(() => {
      finishWizard();
      after?.();
    }, EXIT_MS);
  };

  const runStepAction = (action: () => Promise<'next' | 'stay'>) => {
    setBusy(true);
    setStepError(null);
    void action()
      .then((outcome) => {
        if (outcome === 'next') {
          goNext();
        }
      })
      .catch((error: unknown) => {
        setStepError(formatError(error));
      })
      .finally(() => {
        setBusy(false);
      });
  };

  const createWorkspaceFor = async ({ name }: { readonly name: string }) => {
    const created = await createWorkspace({ name });
    await setCurrentWorkspace(created.id);
    return created;
  };

  const pickFolder = ({ path, replaces }: FolderPick) =>
    runStepAction(async () => {
      setDetection(null);
      setConflict(null);
      const check = await validateGitRepo(path);
      const repoRoot = check.isRepo && check.rootPath != null && check.rootPath !== '';
      const folderPath = check.resolvedPath ?? path;
      if (!repoRoot) {
        const repos = await scanChildRepos({ path: folderPath });
        if (repos.length > 0) {
          setDetection({ parentPath: folderPath, repos });
          return 'stay';
        }
      }
      const rootPath = repoRoot ? (check.rootPath ?? folderPath) : folderPath;
      if (workspace === null) {
        const preview = await previewProjectAdoption({ workspaceId: null, rootPath });
        if (preview !== null) {
          setConflict(preview);
          return 'stay';
        }
        const created = await createWorkspaceFor({ name: workspaceNameFor({ rootPath }) });
        await addProject({ workspaceId: created.id, rootPath, requireRepo: false });
        return 'stay';
      }
      const result = await addProject({ workspaceId: workspace.id, rootPath, requireRepo: false });
      if (result.kind === 'conflict') {
        setConflict(result.conflict);
        return 'stay';
      }
      if (replaces !== null) {
        await removeProject({ projectId: replaces });
      }
      return 'stay';
    });

  const confirmDetection = ({ paths }: { readonly paths: ReadonlyArray<string> }) =>
    runStepAction(async () => {
      if (detection === null) {
        return 'stay';
      }
      const knownConflicts = paths.flatMap((entry) => {
        const known = adoption.knownConflicts[entry];
        return known === undefined ? [] : [known];
      });
      const freshPaths = paths.filter((entry) => adoption.knownConflicts[entry] === undefined);
      const target =
        workspace ??
        (await createWorkspaceFor({
          name: capitalize(folderName({ rootPath: detection.parentPath })),
        }));
      const result = await addProjects({ workspaceId: target.id, rootPaths: freshPaths });
      for (const known of knownConflicts) {
        await adoptProject({ projectId: known.project.id, targetWorkspaceId: target.id });
      }
      setConflict(result.conflicts[0] ?? null);
      setDetection(null);
      return 'stay';
    });

  const moveConflict = () =>
    runStepAction(async () => {
      if (conflict === null) {
        return 'stay';
      }
      const target =
        workspace ??
        (await createWorkspaceFor({
          name: workspaceNameFor({ rootPath: conflict.project.rootPath }),
        }));
      await adoptProject({ projectId: conflict.project.id, targetWorkspaceId: target.id });
      setConflict(null);
      return 'stay';
    });

  const commitProject = () =>
    runStepAction(async () => {
      const name = workspaceName.trim();
      if (workspace !== null && name !== workspace.name) {
        await renameWorkspace({ workspaceId: workspace.id, name });
      }
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
      close();
      return 'stay';
    });
  };

  const handOff = (choice: Exclude<FirstSessionChoice, 'agent'>) => {
    if (workspace === null) {
      return;
    }
    close(() =>
      handOffFirstSession({
        workspaceId: workspace.id,
        projectId: projects[0]?.id ?? null,
        choice,
      }),
    );
  };

  const actions = wizardActions({
    step,
    providersConnected,
    hasWorkspace: workspace !== null,
    workspaceName,
    projectCount,
    codeHostConnected,
    taskSourceConnected,
    isLastStep,
    busy: isLocked,
  });
  const CTA_HANDLERS: Readonly<Record<WizardCtaAction, () => void>> = {
    next: goNext,
    'commit-project': commitProject,
    finish: () => close(),
  };
  const backToCodeHost = steps.includes('code-host') ? () => goTo('code-host') : null;
  const toTasks = steps.includes('tasks') ? () => goTo('tasks') : null;
  const projectName = projects[0]?.name ?? 'this project';

  const renderStep = (id: WizardStepId) => (
    <WizardStepBody
      step={id}
      projectStep={{
        projects,
        name: workspaceName,
        onNameChange: setWorkspaceName,
        busy,
        onPickFolder: pickFolder,
        detection,
        knownRepos: adoption.knownRepos,
        conflict,
        onMoveConflict: moveConflict,
        onKeepConflict: () => setConflict(null),
        onConfirmDetection: confirmDetection,
        onDismissDetection: () => setDetection(null),
        onNewProjectCreated: () => close(),
      }}
      codeHostStep={
        workspaceId === null
          ? null
          : {
              workspaceId,
              originHost,
              projectName: firstRepo?.name ?? null,
              connected: tools.connected,
              githubIdentity: tools.githubIdentity,
            }
      }
      tasksStep={
        workspaceId === null
          ? null
          : {
              workspaceId,
              issueHost,
              preferredHost: originHost,
              connected: tools.connected,
              onBackToCodeHost: backToCodeHost,
            }
      }
      firstSessionStep={{
        projectName,
        hasIssueSource: taskSourceConnected,
        busy,
        onStartScout: startScout,
        onHandOff: handOff,
        onBackToCodeHost: backToCodeHost,
        onConnectTaskManager: toTasks,
      }}
    />
  );

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Goodboy setup"
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') {
          return;
        }
        event.preventDefault();
        close();
      }}
      className={cn(
        'fixed inset-0 z-onboarding grid grid-rows-[52px_minmax(0,1fr)] overflow-hidden bg-background outline-none',
        closing ? 'motion-safe:animate-studio-out' : 'motion-safe:animate-studio-in',
      )}
    >
      <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-6">
        <span className="text-label text-muted-foreground">Setup</span>
        <div className="flex min-w-0 justify-center">
          {mode !== 'single' && <Stepper current={step} steps={steps} />}
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => close()}
            className="rounded-md px-2 py-1 text-label text-faint-foreground transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            Skip setup
          </button>
        </div>
      </header>

      <ScrollFade className="min-h-0">
        <div className="flex justify-center px-6 pb-10 pt-7">
          <div
            className={cn(
              'flex w-full flex-col gap-8',
              step === 'first-session' ? 'max-w-[604px]' : 'max-w-[540px]',
            )}
          >
            <div className="flex flex-col gap-4">
              <StepTransition transition={transition} renderStep={renderStep} />
              {stepError !== null ? (
                <p role="alert" className="text-label text-danger">
                  {stepError}
                </p>
              ) : null}
            </div>
            <FormActions reason={actions.hint}>
              {isFirstStep ? null : (
                <Button
                  variant="ghost"
                  onClick={goBack}
                  disabled={isLocked}
                  className="text-muted-foreground"
                >
                  Back
                </Button>
              )}
              {actions.skip !== null && (
                <Button
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
                  variant="primary"
                  disabled={actions.primary.disabled}
                  onClick={CTA_HANDLERS[actions.primary.action]}
                >
                  {actions.primary.label}
                </Button>
              )}
            </FormActions>
          </div>
        </div>
      </ScrollFade>
    </div>
  );
};
