import type {
  Agent,
  AttachmentInput,
  IsoDateTime,
  ModelEffort,
  ProviderId,
  Session,
  SessionId,
  SessionMount,
  SessionExternalTask,
  SessionExternalTaskProvider,
  SessionProviderPreference,
  TurnState,
  WorkflowId,
  WorkflowRunId,
  WorkspaceId,
  WorkspaceMember,
} from '@goodboy/types';
import { DEFAULT_SESSION_PROVIDER_PREFERENCE } from '@goodboy/types';
import {
  insertSession,
  insertSessionWorktree,
  listWorkspaces,
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
  readonly memberWorkspaceId?: WorkspaceId;
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
        target.memberWorkspaceId,
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
  externalTask?: {
    provider: SessionExternalTaskProvider;
    mountWorkspaceId?: WorkspaceId;
    externalId: string;
    identifier: string;
    url: string;
    title: string;
  };
  attachmentInputs?: ReadonlyArray<AttachmentInput>;
  // TODO (@ak): origin marker for the pending sandbox-exec confinement. Marked
  // synchronously before any async kickoff so a turn fired during creation is
  // already tagged mobile-origin. No longer affects permission mode.
  mobileShared?: boolean;
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
    externalTask,
    attachmentInputs,
    mobileShared = false,
  }: Input): Promise<{ session: Session; worktree: CreatedWorktree }> => {
    const workspace = (await listWorkspaces(tauriDatabase)).find((w) => w.id === workspaceId);
    if (!workspace) {
      throw new Error(`workspace not found: ${workspaceId}`);
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
    const isComposite = workspace.kind === 'composite';
    const isSimple = workspace.kind === 'simple';
    const members = isComposite ? (workspace.members ?? []) : [];
    if (isComposite && members.length < 2) {
      throw new Error(`multi-project workspace has no linked repos: ${workspaceId}`);
    }

    let worktree: CreatedWorktree;
    const memberWorktrees: Array<{ member: WorkspaceMember; worktree: CreatedWorktree }> = [];
    if (isSimple) {
      const dirSlug = `${slugifyDir(slugSeed)}-${sessionId.slice(0, 8)}`;
      const directoryName =
        folderName !== undefined
          ? folderName
          : deriveDefaultSessionDirectoryNameFromGoal({ goal: goal.trim() });
      worktree = await createSessionDir({
        basePath: workspace.rootPath,
        slug: dirSlug,
        directoryName,
        sessionId,
        workspaceId,
      });
    } else if (isComposite) {
      const dirSlug = `${slugifyDir(slugSeed)}-${sessionId.slice(0, 8)}`;
      const compositeDir = `${workspace.rootPath}/${dirSlug}`;
      for (const member of members) {
        const wt = await createWorktree({
          repoPath: member.rootPath,
          branchPrefix: prefix,
          slug: dirSlug,
          parentDir: compositeDir,
          dirName: member.mountName,
          ...(trimmedExisting ? { existingBranch: trimmedExisting } : {}),
          ...(trimmedExisting && trimmedFallbackRef ? { fallbackRef: trimmedFallbackRef } : {}),
        });
        memberWorktrees.push({ member, worktree: wt });
      }
      const branchName = memberWorktrees[0]?.worktree.branchName ?? `${prefix}/${dirSlug}`;
      worktree = { worktreePath: compositeDir, branchName, slug: dirSlug, reused: false };
    } else {
      worktree = await createWorktree({
        repoPath: workspace.rootPath,
        branchPrefix: prefix,
        slug: slugSeed,
        ...(trimmedExisting ? { existingBranch: trimmedExisting } : {}),
        ...(trimmedExisting && trimmedFallbackRef ? { fallbackRef: trimmedFallbackRef } : {}),
      });
    }

    if (!get().workspaceOverrides[workspaceId]) {
      try {
        await get().loadWorkspaceOverrides(workspaceId);
      } catch {
        // best-effort: missing overrides just means we fall back to global default
      }
    }
    const workspaceOverrides = get().workspaceOverrides[workspaceId] ?? null;
    const workspaceDefaultProvider = workspaceOverrides?.defaultProviderId ?? null;
    const inheritedDefaultProvider =
      workspaceDefaultProvider ?? DEFAULT_SESSION_PROVIDER_PREFERENCE.defaultProvider;
    const inheritedEnabledProviders =
      workspaceOverrides?.enabledProviders == null
        ? undefined
        : Array.from(new Set([...workspaceOverrides.enabledProviders, inheritedDefaultProvider]));
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
    let externalTaskRow: SessionExternalTask | null = null;
    if (externalTask) {
      externalTaskRow = {
        sessionId: session.id,
        ...(externalTask.mountWorkspaceId != null
          ? { mountWorkspaceId: externalTask.mountWorkspaceId }
          : {}),
        ...(worktree.branchName !== '' ? { branch: worktree.branchName } : {}),
        provider: externalTask.provider,
        externalId: externalTask.externalId,
        identifier: externalTask.identifier,
        url: externalTask.url,
        title: externalTask.title,
        createdAt: now,
      };
      try {
        await upsertSessionExternalTask({ db: tauriDatabase, task: externalTaskRow });
      } catch {
        externalTaskRow = null;
      }
    }
    await insertSessionWorktree(tauriDatabase, {
      id: crypto.randomUUID(),
      sessionId: session.id,
      worktreePath: worktree.worktreePath,
      branch: worktree.branchName,
      parallelIndex: 0,
      createdAt: Date.now(),
    });
    for (let i = 0; i < memberWorktrees.length; i += 1) {
      const { member, worktree: wt } = memberWorktrees[i]!;
      await insertSessionWorktree(tauriDatabase, {
        id: crypto.randomUUID(),
        sessionId: session.id,
        worktreePath: wt.worktreePath,
        branch: wt.branchName,
        parallelIndex: i + 1,
        mountWorkspaceId: member.workspaceId,
        mountName: member.mountName,
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
    const repoSlugTargets: ReadonlyArray<RepoSlugTarget> = isComposite
      ? memberWorktrees.map(({ member, worktree: wt }) => ({
          repoRoot: member.rootPath,
          worktreePath: wt.worktreePath,
          memberWorkspaceId: member.workspaceId,
        }))
      : isSimple
        ? []
        : [{ repoRoot: workspace.rootPath, worktreePath: worktree.worktreePath }];
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
    const sessionMounts: ReadonlyArray<SessionMount> = memberWorktrees.map(
      ({ member, worktree: memberWorktree }) => ({
        workspaceId: member.workspaceId,
        mountName: member.mountName,
        worktreePath: memberWorktree.worktreePath,
        repoRoot: member.rootPath,
        branch: memberWorktree.branchName,
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
        [session.id]: externalTaskRow ? [externalTaskRow] : [],
      },
      sessionWorktrees: {
        ...state.sessionWorktrees,
        [session.id]: [
          worktree.worktreePath,
          ...memberWorktrees.map((m) => m.worktree.worktreePath),
        ],
      },
      sessionMounts: {
        ...state.sessionMounts,
        [session.id]: sessionMounts,
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
