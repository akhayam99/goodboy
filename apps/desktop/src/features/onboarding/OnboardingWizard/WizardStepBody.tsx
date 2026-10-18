import { useMemo, useState } from 'react';
import { Button, FormActions, formatError } from '@goodboy/ui';
import { useAppStore } from '../../../store';
import type { ProjectAttachConflict } from '../../../store/slices/projects/addProject';
import { scanChildRepos, validateGitRepo } from '../../../shared/lib/repo';
import type { DetectedChildRepos } from '../../../shared/hooks/useChildRepoDetection';
import { useProjectAdoption } from '../../../shared/hooks/useProjectAdoption';
import { useToolConnections } from '../../integrations/useToolConnections';
import type { WizardContext } from './useOnboardingWizard';
import { nameFromFolder } from '../../workspace/nameFromFolder';
import { useProjectRemote } from './useProjectRemote';
import { hostFromRemote } from './hostFromRemote';
import { handOffFirstSession, startFirstScout } from './startFirstSession';
import { wizardActions, type WizardCtaAction } from './wizardCta';
import type { WizardNav, WizardStepId } from './wizardSteps';
import { WelcomeStep } from './steps/WelcomeStep';
import { ProvidersStep } from './steps/ProvidersStep';
import { ProjectStep, type FolderPick } from './steps/ProjectStep';
import { CodeHostStep } from './steps/CodeHostStep';
import { TasksStep } from './steps/TasksStep';
import { FirstSessionStep, type FirstSessionChoice } from './steps/FirstSessionStep';

type Props = {
  readonly step: WizardStepId;
  readonly nav: WizardNav;
  readonly wizard: WizardContext;
};

type StepOutcome = 'next' | 'stay';

type NameParams = {
  readonly name: string;
};

type PathsParams = {
  readonly paths: ReadonlyArray<string>;
};

export const WizardStepBody = ({ step, nav, wizard }: Props) => {
  const { providersConnected, workspace, projectCount, projects } = wizard;
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
  const [workspaceName, setWorkspaceName] = useState(workspace?.name ?? '');
  const [namedWorkspaceId, setNamedWorkspaceId] = useState(workspace?.id ?? null);
  const [isBusy, setIsBusy] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);
  const detectedPaths = useMemo(() => detection?.repos.map((repo) => repo.path) ?? [], [detection]);
  const workspaceId = workspace?.id ?? null;
  const adoption = useProjectAdoption({ workspaceId, detectedPaths });
  const tools = useToolConnections({ workspaceId });
  const firstRepo = projects.filter((project) => project.kind === 'repo')[0] ?? null;
  const originHost = hostFromRemote(useProjectRemote({ project: firstRepo }));

  if (workspaceId !== namedWorkspaceId) {
    setNamedWorkspaceId(workspaceId);
    setWorkspaceName(workspace?.name ?? '');
  }

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

  const createWorkspaceFor = async ({ name }: NameParams) => {
    const created = await createWorkspace({ name });
    await setCurrentWorkspace(created.id);
    return created;
  };

  const pickFolder = ({ path, replaces }: FolderPick) =>
    runStepAction(async () => {
      setDetection(null);
      setConflict(null);
      const check = await validateGitRepo(path);
      const isRepoRoot = check.isRepo && check.rootPath != null && check.rootPath !== '';
      const folderPath = check.resolvedPath ?? path;
      if (!isRepoRoot) {
        const repos = await scanChildRepos({ path: folderPath });
        if (repos.length > 0) {
          setDetection({ parentPath: folderPath, repos });
          return 'stay';
        }
      }
      const rootPath = isRepoRoot ? (check.rootPath ?? folderPath) : folderPath;
      if (workspace === null) {
        const preview = await previewProjectAdoption({ workspaceId: null, rootPath });
        if (preview !== null) {
          setConflict(preview);
          return 'stay';
        }
        const created = await createWorkspaceFor({ name: nameFromFolder({ path: rootPath }) });
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

  const confirmDetection = ({ paths }: PathsParams) =>
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
        (await createWorkspaceFor({ name: nameFromFolder({ path: detection.parentPath }) }));
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
        (await createWorkspaceFor({ name: nameFromFolder({ path: conflict.project.rootPath }) }));
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
    hasWorkspace: workspace !== null,
    workspaceName,
    projectCount,
    codeHostConnected: isCodeHostConnected,
    taskSourceConnected: isTaskSourceConnected,
    isLastStep: nav.isLast,
    busy: isLocked,
  });
  const CTA_HANDLERS: Readonly<Record<WizardCtaAction, () => void>> = {
    next: nav.goNext,
    'commit-project': commitProject,
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
        return (
          <ProjectStep
            projects={projects}
            name={workspaceName}
            onNameChange={setWorkspaceName}
            busy={isBusy}
            onPickFolder={pickFolder}
            detection={detection}
            knownRepos={adoption.knownRepos}
            conflict={conflict}
            onMoveConflict={moveConflict}
            onKeepConflict={() => setConflict(null)}
            onConfirmDetection={confirmDetection}
            onDismissDetection={() => setDetection(null)}
            onNewProjectCreated={() => nav.finish()}
          />
        );
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
    </div>
  );
};
