import type {
  Agent,
  AttachmentInput,
  IsoDateTime,
  ModelEffort,
  Project,
  ProjectId,
  ProviderId,
  Session,
  SessionId,
  SessionProjectMount,
  SessionExternalTask,
  SessionExternalTaskProvider,
  SessionProviderPreference,
  TurnState,
  WorkflowId,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';
import { DEFAULT_SESSION_PROVIDER_PREFERENCE } from '@goodboy/types';
import {
  insertSession,
  insertSessionWorktree,
  getWorkspaceById,
  listProjectsForWorkspace,
  updateSessionWorktreeRepoSlug,
  upsertSessionExternalTask,
  setSetting as dbSetSetting,
  upsertContextSlot,
} from '@goodboy/db';
import { detectRepoSlug } from '@goodboy/core';
import { tauriDatabase } from '../../../shared/lib/db';
import { tauriGhRunner } from '../../../features/github/github';
import {
  createSessionDir,
  createWorktree,
  type CreatedWorktree,
} from '../../../features/worktree/worktree';
import { invokeAgentInsert } from '../../../features/workflows/workflows';
import { kindRouting, AGENT_KIND_META, type AgentKind } from '../../../features/session/agent-kind';
import {
  SETTING_LAST_SESSION_ID,
  DEFAULT_BRANCH_PREFIX,
} from '../../../features/settings/settings';
import { markSessionMobileShared } from '../../../features/companion/mobileConfinement';
import { workSurfaceFocus } from '../session-view/workSurfaceFocus';
import { clampTitle } from './titleLimit';
import { preSpawnWorkflowAgents } from '../workflows/preSpawnWorkflowAgents';
import { deriveDefaultSessionDirectoryNameFromGoal } from '../../../shared/utils/deriveDefaultSessionDirectoryNameFromGoal';
import type { GetFn, SetFn } from './types';

type RepoSlugTarget = {
  readonly repoRoot: string;
  readonly worktreePath: string;
  readonly projectId?: ProjectId;
};

type PopulateRepoSlugsParams = {
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
  readonly targets: ReadonlyArray<RepoSlugTarget>;
};

const populateWorktreeRepoSlugs = async ({
  sessionId,
  workspaceId,
  targets,
}: PopulateRepoSlugsParams): Promise<void> => {
  for (const target of targets) {
    try {
      const slug = await detectRepoSlug(
        tauriGhRunner,
        target.repoRoot,
        workspaceId,
        target.projectId,
      );
      if (slug == null) {
        continue;
      }
      await updateSessionWorktreeRepoSlug({
        db: tauriDatabase,
        sessionId,
        worktreePath: target.worktreePath,
        repoSlug: slug,
      });
    } catch {
      continue;
    }
  }
};

const slugifyDir = (raw: string): string =>
  raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'session';

type ExternalTaskInput = {
  provider: SessionExternalTaskProvider;
  projectId?: ProjectId;
  externalId: string;
  identifier: string;
  url: string;
  title: string;
};

type Input = {
  workspaceId: WorkspaceId;
  goal: string;
  branchPrefix?: string;
  branchSlug?: string;
  existingBranch?: string;
  fallbackRef?: string;
  folderName?: string;
  providerPreference?: SessionProviderPreference;
  workflowId?: WorkflowId;
  autoRun?: boolean;
  firstAgentKind?: AgentKind;
  firstAgentModel?: string;
  kickoffPrompt?: string;
  externalTasks?: ReadonlyArray<ExternalTaskInput>;
  attachmentInputs?: ReadonlyArray<AttachmentInput>;
  mobileShared?: boolean;
};

type MaterializedProject = {
  readonly project: Project;
  readonly worktree: CreatedWorktree;
};

export const createSession = (set: SetFn, get: GetFn) => {
  return async ({
    workspaceId,
    goal,
    branchPrefix,
    branchSlug,
    existingBranch,
    fallbackRef,
    folderName,
    providerPreference,
    workflowId,
    autoRun,
    firstAgentKind,
    firstAgentModel: requestedModel,
    kickoffPrompt,
    externalTasks,
    attachmentInputs,
    mobileShared = false,
  }: Input): Promise<{ session: Session; worktree: CreatedWorktree }> => {
    const workspace = await getWorkspaceById({ db: tauriDatabase, id: workspaceId });
    if (workspace === null) {
      throw new Error(`workspace not found: ${workspaceId}`);
    }
    const projects = await listProjectsForWorkspace({ db: tauriDatabase, workspaceId });
    if (projects.length === 0) {
      throw new Error(`workspace has no projects: ${workspaceId}`);
    }

    const prefix = branchPrefix?.trim() || DEFAULT_BRANCH_PREFIX;
    const slugSeed =
      branchSlug?.trim() || (goal.trim().length > 0 ? goal : `session-${Date.now()}`);
    const trimmedExisting = existingBranch?.trim();
    const trimmedFallbackRef = fallbackRef?.trim();
    const sessionId = crypto.randomUUID() as SessionId;
    if (mobileShared) {
      markSessionMobileShared(sessionId);
    }
    const dirSlug = `${slugifyDir(slugSeed)}-${sessionId.slice(0, 8)}`;
    const isMultiProject = projects.length > 1;
    const sessionRoot = workspace.sessionsRoot ?? projects[0]!.rootPath;
    const containerDir = `${sessionRoot}/${dirSlug}`;
    const materializedProjects: Array<MaterializedProject> = [];
    // TODO (@ak): lazy in phase 3
    for (const project of projects) {
      const directoryName = isMultiProject
        ? project.name
        : (folderName ?? deriveDefaultSessionDirectoryNameFromGoal({ goal: goal.trim() }));
      const projectWorktree =
        project.kind === 'repo'
          ? await createWorktree({
              repoPath: project.rootPath,
              branchPrefix: prefix,
              slug: isMultiProject ? dirSlug : slugSeed,
              ...(isMultiProject ? { parentDir: containerDir, dirName: project.name } : {}),
              ...(trimmedExisting !== undefined ? { existingBranch: trimmedExisting } : {}),
              ...(trimmedExisting !== undefined && trimmedFallbackRef !== undefined
                ? { fallbackRef: trimmedFallbackRef }
                : {}),
            })
          : await createSessionDir({
              basePath: isMultiProject ? containerDir : project.rootPath,
              slug: dirSlug,
              directoryName,
              sessionId,
              workspaceId,
            });
      materializedProjects.push({ project, worktree: projectWorktree });
    }
    const firstMaterialized = materializedProjects[0]!;
    const worktree: CreatedWorktree = isMultiProject
      ? {
          worktreePath: containerDir,
          branchName: firstMaterialized.worktree.branchName,
          slug: dirSlug,
          reused: false,
        }
      : firstMaterialized.worktree;

    if (!get().workspaceOverrides[workspaceId]) {
      await get()
        .loadWorkspaceOverrides(workspaceId)
        .catch(() => undefined);
    }
    const workspaceOverrides = get().workspaceOverrides[workspaceId] ?? null;
    const workspaceDefaultProvider = workspaceOverrides?.defaultProviderId ?? null;
    const inheritedDefaultProvider =
      workspaceDefaultProvider ?? DEFAULT_SESSION_PROVIDER_PREFERENCE.defaultProvider;
    const inheritedEnabledProviders =
      workspaceOverrides?.providerPool == null
        ? undefined
        : Array.from(new Set([...workspaceOverrides.providerPool, inheritedDefaultProvider]));
    const inheritedPreference: SessionProviderPreference = {
      ...DEFAULT_SESSION_PROVIDER_PREFERENCE,
      defaultProvider: inheritedDefaultProvider,
      ...(inheritedEnabledProviders == null ? {} : { enabledProviders: inheritedEnabledProviders }),
    };

    const now = new Date().toISOString() as IsoDateTime;
    const initialState: TurnState = { kind: 'draft' };
    const runAutoRun = autoRun === true && workflowId !== undefined;
    const workflowRunId =
      workflowId !== undefined ? (crypto.randomUUID() as WorkflowRunId) : undefined;
    const session: Session = {
      id: sessionId,
      workspaceId,
      activeProjectId: firstMaterialized.project.id,
      goal: clampTitle(goal.trim() || worktree.slug),
      state: initialState,
      contextSlots: [],
      providerPreference: providerPreference ?? inheritedPreference,
      permissionMode: 'bypassPermissions',
      workflowRuns:
        workflowId !== undefined && workflowRunId !== undefined
          ? [
              {
                id: workflowRunId,
                workflowId,
                ordinal: 0,
                currentStep: 0,
                autoRun: runAutoRun,
                triggerMode: 'immediate' as const,
                executionMode: 'static' as const,
                createdAt: now,
              },
            ]
          : [],
      autoRun: runAutoRun,
      titleUserEdited: false,
      createdAt: now,
      updatedAt: now,
    };
    await insertSession(tauriDatabase, session);
    const externalTaskRows: Array<SessionExternalTask> = [];
    for (const externalTask of externalTasks ?? []) {
      const row: SessionExternalTask = {
        sessionId: session.id,
        ...(externalTask.projectId != null ? { projectId: externalTask.projectId } : {}),
        ...(worktree.branchName !== '' ? { branch: worktree.branchName } : {}),
        provider: externalTask.provider,
        externalId: externalTask.externalId,
        identifier: externalTask.identifier,
        url: externalTask.url,
        title: externalTask.title,
        createdAt: now,
      };
      try {
        await upsertSessionExternalTask({ db: tauriDatabase, task: row });
        externalTaskRows.push(row);
      } catch {
        continue;
      }
    }
    if (isMultiProject) {
      await insertSessionWorktree(tauriDatabase, {
        id: crypto.randomUUID(),
        sessionId: session.id,
        worktreePath: worktree.worktreePath,
        branch: worktree.branchName,
        parallelIndex: 0,
        createdAt: Date.now(),
      });
    }
    for (let index = 0; index < materializedProjects.length; index += 1) {
      const materialized = materializedProjects[index]!;
      await insertSessionWorktree(tauriDatabase, {
        id: crypto.randomUUID(),
        sessionId: session.id,
        worktreePath: materialized.worktree.worktreePath,
        branch: materialized.worktree.branchName,
        parallelIndex: isMultiProject ? index + 1 : 0,
        projectId: materialized.project.id,
        mountName: materialized.project.name,
        createdAt: Date.now(),
      });
    }
    await get().recordSessionEvent({
      sessionId: session.id,
      kind: 'worktree_created',
      payload: { worktreePath: worktree.worktreePath },
    });
    if (worktree.branchName.length > 0) {
      await get().recordSessionEvent({
        sessionId: session.id,
        kind: 'branch_created',
        payload: { branch: worktree.branchName },
      });
    }
    const repoSlugTargets: ReadonlyArray<RepoSlugTarget> = materializedProjects.flatMap(
      (materialized) =>
        materialized.project.kind === 'folder'
          ? []
          : [
              {
                repoRoot: materialized.project.rootPath,
                worktreePath: materialized.worktree.worktreePath,
                projectId: materialized.project.id,
              },
            ],
    );
    void populateWorktreeRepoSlugs({ sessionId, workspaceId, targets: repoSlugTargets });

    const goalText = goal.trim() || worktree.slug;
    if (goalText.length > 0) {
      await upsertContextSlot(tauriDatabase, session.id, {
        key: 'goal',
        value: goalText,
        enabled: true,
      });
    }

    let prespawnedRuns: ReadonlyArray<Agent>;
    let firstStepPromptPrefix = '';
    const agentModelOverrides: Record<string, string> = {};
    const agentKindOverrides: Record<string, string> = {};
    const agentProviderOverrides: Record<string, ProviderId> = {};
    const agentEffortOverrides: Record<string, ModelEffort> = {};

    const workspaceVerbositySeed =
      get().workspaceOverrides[workspaceId]?.defaultVerbosity ?? undefined;
    const roleModels = get().workspaceOverrides[workspaceId]?.roleModels ?? null;

    if (workflowId) {
      const templates = get().phaseTemplates[workspaceId] ?? [];
      const template = templates.find((t) => t.id === workflowId) ?? null;
      const sortedSteps = template ? [...template.steps].sort((a, b) => a.ordinal - b.ordinal) : [];

      if (sortedSteps.length > 0) {
        const spawned = await preSpawnWorkflowAgents({
          sessionId: session.id,
          ...(workflowRunId !== undefined && { workflowRunId }),
          steps: sortedSteps,
          baseOrdinal: 0,
          defaultProvider: session.providerPreference.defaultProvider,
          roleModels,
          ...(workspaceVerbositySeed != null && { defaultVerbosity: workspaceVerbositySeed }),
        });
        Object.assign(agentModelOverrides, spawned.modelOverrides);
        Object.assign(agentKindOverrides, spawned.kindOverrides);
        Object.assign(agentProviderOverrides, spawned.providerOverrides);
        Object.assign(agentEffortOverrides, spawned.effortOverrides);
        firstStepPromptPrefix = sortedSteps[0]!.promptPrefix;
        prespawnedRuns = spawned.agents;
      } else {
        const fallback = await invokeAgentInsert({
          sessionId: session.id,
          ...(workflowRunId !== undefined && { workflowRunId }),
          ordinal: 0,
          name: 'agent 1',
          status: 'pending',
          ...(workspaceVerbositySeed && { verbosity: workspaceVerbositySeed }),
        });
        prespawnedRuns = [fallback];
      }
    } else if (firstAgentKind !== undefined) {
      const agentName = AGENT_KIND_META[firstAgentKind].label.toLowerCase();
      const model = requestedModel ?? kindRouting({ kind: firstAgentKind, roleModels }).model;
      const singleAgent = await invokeAgentInsert({
        sessionId: session.id,
        ordinal: 0,
        name: agentName,
        status: 'pending',
        kind: firstAgentKind,
        ...(workspaceVerbositySeed && { verbosity: workspaceVerbositySeed }),
      });
      if (model !== null) {
        agentModelOverrides[singleAgent.id] = model;
      }
      agentKindOverrides[singleAgent.id] = firstAgentKind;
      prespawnedRuns = [singleAgent];
    } else {
      prespawnedRuns = [];
    }

    const firstAgent = prespawnedRuns[0] ?? null;
    const sessionProjectMounts: ReadonlyArray<SessionProjectMount> = materializedProjects.map(
      (materialized) => ({
        projectId: materialized.project.id,
        mountName: materialized.project.name,
        worktreePath: materialized.worktree.worktreePath,
        repoRoot: materialized.project.rootPath,
        branch: materialized.worktree.branchName,
      }),
    );
    const transcriptEntries: Record<string, ReadonlyArray<never>> = {};
    const turnStateEntries: Record<string, { kind: 'draft' }> = {};
    for (const agent of prespawnedRuns) {
      transcriptEntries[agent.id] = [];
      turnStateEntries[agent.id] = { kind: 'draft' };
    }

    set((state) => ({
      sessions:
        state.currentWorkspaceId === workspaceId ? [session, ...state.sessions] : state.sessions,
      currentSessionId: session.id,
      sessionSummary: null,
      sessionExternalTasks: {
        ...state.sessionExternalTasks,
        [session.id]: externalTaskRows,
      },
      sessionWorktrees: {
        ...state.sessionWorktrees,
        [session.id]: isMultiProject
          ? [
              worktree.worktreePath,
              ...materializedProjects.map((materialized) => materialized.worktree.worktreePath),
            ]
          : [worktree.worktreePath],
      },
      sessionProjectMounts: {
        ...state.sessionProjectMounts,
        [session.id]: sessionProjectMounts,
      },
      sessionActiveProject: {
        ...state.sessionActiveProject,
        [session.id]: firstMaterialized.project.id,
      },
      sessionBranches: {
        ...state.sessionBranches,
        [session.id]: worktree.branchName,
      },
      sessionSlots: {
        ...state.sessionSlots,
        [session.id]: goalText.length > 0 ? [{ key: 'goal', value: goalText, enabled: true }] : [],
      },
      sessionPhaseRuns: { ...state.sessionPhaseRuns, [session.id]: prespawnedRuns },
      sessionWorkflows: {
        ...state.sessionWorkflows,
        [session.id]: (() => {
          if (workflowId == null) {
            return [];
          }
          const templates = state.phaseTemplates[workspaceId] ?? [];
          const tpl = templates.find((t) => t.id === workflowId);
          return tpl ? [tpl] : [];
        })(),
      },
      ...workSurfaceFocus({
        sessionId: session.id,
        focus: {
          kind: 'session-created',
          studio: null,
          agentId: firstAgent?.id ?? null,
        },
        activeLens: state.activeLens,
        sessionStudio: state.sessionStudio,
        selectedAgentId: state.selectedAgentId,
      }),
      transcripts: { ...state.transcripts, ...transcriptEntries },
      messages: { ...state.messages, [session.id]: [] },
      sessionOpenQuestions: { ...state.sessionOpenQuestions, [session.id]: [] },
      sessionPlans: { ...state.sessionPlans, [session.id]: [] },
      agentTurnState: { ...state.agentTurnState, ...turnStateEntries },
      agentModelOverride: { ...get().agentModelOverride, ...agentModelOverrides },
      agentKindOverride: { ...get().agentKindOverride, ...agentKindOverrides },
      agentProviderOverride: { ...get().agentProviderOverride, ...agentProviderOverrides },
      agentEffortOverride: { ...get().agentEffortOverride, ...agentEffortOverrides },
    }));
    await dbSetSetting(tauriDatabase, SETTING_LAST_SESSION_ID, session.id);

    if (attachmentInputs && attachmentInputs.length > 0) {
      await get().addGoalAttachments({ type: 'session', id: session.id }, attachmentInputs);
    }

    if (workflowId) {
      void get().reprocessGoalForWorkflow(session.id);
    }

    const trimmedKickoffPrompt = kickoffPrompt?.trim();
    if (firstStepPromptPrefix.length > 0) {
      void get().sendTurn({ sessionId: session.id, content: firstStepPromptPrefix });
    } else if (firstAgent != null && trimmedKickoffPrompt != null && trimmedKickoffPrompt !== '') {
      void get().sendTurn({ sessionId: session.id, content: trimmedKickoffPrompt });
    } else if (firstAgentKind && firstAgentKind !== 'generic' && goalText.length > 0) {
      void get().sendTurn({ sessionId: session.id, content: goalText });
    }

    void get().emitNotification(
      'session-created',
      'success',
      `session created: ${session.goal}`,
      undefined,
      { sessionId: session.id, workspaceId: session.workspaceId },
    );

    return { session, worktree };
  };
};
