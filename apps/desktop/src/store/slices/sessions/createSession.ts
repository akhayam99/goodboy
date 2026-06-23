import type {
  Agent,
  AttachmentInput,
  IsoDateTime,
  Session,
  SessionId,
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
  setSessionExternalTask,
  setSetting as dbSetSetting,
  upsertContextSlot,
} from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { createWorktree, type CreatedWorktree } from '../../../features/worktree/worktree';
import { invokeAgentInsert } from '../../../features/workflows/workflows';
import {
  AGENT_KIND_DEFAULTS,
  AGENT_KIND_META,
  ROLE_TO_KIND,
  inferAgentKindFromName,
  type AgentKind,
} from '../../../features/session/agent-kind';
import {
  SETTING_LAST_SESSION_ID,
  DEFAULT_BRANCH_PREFIX,
} from '../../../features/settings/settings';
import {
  clampMobilePermissionMode,
  markSessionMobileShared,
} from '../../../features/companion/mobileConfinement';
import type { GetFn, SetFn } from './types';

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
  providerPreference?: SessionProviderPreference;
  workflowId?: WorkflowId;
  autoRun?: boolean;
  firstAgentKind?: AgentKind;
  firstAgentModel?: string;
  externalTask?: {
    provider: SessionExternalTaskProvider;
    externalId: string;
    identifier: string;
    url: string;
    title: string;
  };
  attachmentInputs?: ReadonlyArray<AttachmentInput>;
  // Origin marker. When true, this session was launched by a paired phone: it is
  // registered mobile-shared SYNCHRONOUSLY (before any kickoff turn is
  // dispatched) and its stored permission mode is clamped at creation, so the
  // confinement is intrinsic and order-independent — a kickoff turn fired during
  // creation can never run before the mark lands. Default false → desktop
  // behavior is unchanged (full `bypassPermissions`, no mark).
  mobileShared?: boolean;
};

export const createSession = (set: SetFn, get: GetFn) => {
  return async ({
    workspaceId,
    goal,
    branchPrefix,
    branchSlug,
    existingBranch,
    providerPreference,
    workflowId,
    autoRun,
    firstAgentKind,
    firstAgentModel: requestedModel,
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
    const sessionId = crypto.randomUUID() as SessionId;
    // SECURITY (ordering): register the confinement BEFORE anything async that
    // could dispatch a turn for this session (worktree setup, workflow prespawn,
    // the kickoff sendTurn at the end of this fn). markSessionMobileShared is
    // synchronous and module-scoped, so once this line runs every sendTurn for
    // sessionId — including a kickoff fired during creation — clamps at the
    // sendTurn choke point. Doing it here (not after createSession resolves in
    // the executor) closes the race where a kickoff could outrun the mark.
    if (mobileShared) {
      markSessionMobileShared(sessionId);
    }
    const isComposite = workspace.kind === 'composite';
    const members = isComposite ? (workspace.members ?? []) : [];
    if (isComposite && members.length < 2) {
      throw new Error(`multi-project workspace has no linked repos: ${workspaceId}`);
    }

    let worktree: CreatedWorktree;
    const memberWorktrees: Array<{ member: WorkspaceMember; worktree: CreatedWorktree }> = [];
    if (isComposite) {
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
      });
    }

    if (!get().workspaceOverrides[workspaceId]) {
      try {
        await get().loadWorkspaceOverrides(workspaceId);
      } catch {
        // best-effort: missing overrides just means we fall back to global default
      }
    }
    const workspaceDefaultProvider =
      get().workspaceOverrides[workspaceId]?.defaultProviderId ?? null;
    const inheritedPreference: SessionProviderPreference = workspaceDefaultProvider
      ? { ...DEFAULT_SESSION_PROVIDER_PREFERENCE, defaultProvider: workspaceDefaultProvider }
      : DEFAULT_SESSION_PROVIDER_PREFERENCE;

    const now = new Date().toISOString() as IsoDateTime;
    const initialState: TurnState = { kind: 'draft' };
    const runAutoRun = autoRun === true && workflowId !== undefined;
    const workflowRunId =
      workflowId !== undefined ? (crypto.randomUUID() as WorkflowRunId) : undefined;
    const session: Session = {
      id: sessionId,
      workspaceId,
      goal: goal.trim() || worktree.slug,
      state: initialState,
      contextSlots: [],
      providerPreference: providerPreference ?? inheritedPreference,
      // Desktop sessions run at full power; a mobile-launched session stores a
      // clamped mode so the ceiling is intrinsic to the session (not only
      // applied at sendTurn). Belt-and-suspenders with the sendTurn clamp.
      permissionMode: mobileShared
        ? clampMobilePermissionMode('bypassPermissions')
        : 'bypassPermissions',
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
        provider: externalTask.provider,
        externalId: externalTask.externalId,
        identifier: externalTask.identifier,
        url: externalTask.url,
        title: externalTask.title,
        createdAt: now,
      };
      try {
        await setSessionExternalTask(tauriDatabase, externalTaskRow);
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

    const goalText = session.goal.trim();
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

    const workspaceVerbositySeed =
      get().workspaceOverrides[workspaceId]?.defaultVerbosity ?? undefined;

    if (workflowId) {
      const templates = get().phaseTemplates[workspaceId] ?? [];
      const template = templates.find((t) => t.id === workflowId) ?? null;
      const sortedSteps = template ? [...template.steps].sort((a, b) => a.ordinal - b.ordinal) : [];

      if (sortedSteps.length > 0) {
        const allAgents: Agent[] = [];
        for (const step of sortedSteps) {
          const kind = step.role ? ROLE_TO_KIND[step.role] : inferAgentKindFromName(step.name);
          const agent = await invokeAgentInsert({
            sessionId: session.id,
            stepId: step.id,
            ...(workflowRunId !== undefined && { workflowRunId }),
            ordinal: step.ordinal,
            name: step.name,
            status: 'pending',
            kind,
            ...(workspaceVerbositySeed && { verbosity: workspaceVerbositySeed }),
          });
          agentModelOverrides[agent.id] = step.modelOverride ?? AGENT_KIND_DEFAULTS[kind].model;
          agentKindOverrides[agent.id] = kind;
          allAgents.push(agent);
        }
        firstStepPromptPrefix = sortedSteps[0]!.promptPrefix;
        prespawnedRuns = allAgents;
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
      const model = requestedModel ?? AGENT_KIND_DEFAULTS[firstAgentKind].model;
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
      sessionExternalTasks: externalTaskRow
        ? { ...state.sessionExternalTasks, [session.id]: externalTaskRow }
        : state.sessionExternalTasks,
      sessionWorktrees: {
        ...state.sessionWorktrees,
        [session.id]: [
          worktree.worktreePath,
          ...memberWorktrees.map((m) => m.worktree.worktreePath),
        ],
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
      sessionWorkflows: workflowId
        ? {
            ...state.sessionWorkflows,
            [session.id]: (() => {
              const templates = state.phaseTemplates[workspaceId] ?? [];
              const tpl = templates.find((t) => t.id === workflowId);
              return tpl ? [tpl] : [];
            })(),
          }
        : state.sessionWorkflows,
      selectedAgentId: firstAgent
        ? { ...state.selectedAgentId, [session.id]: firstAgent.id }
        : state.selectedAgentId,
      transcripts: { ...state.transcripts, ...transcriptEntries },
      messages: { ...state.messages, [session.id]: [] },
      agentTurnState: { ...state.agentTurnState, ...turnStateEntries },
      agentModelOverride: { ...get().agentModelOverride, ...agentModelOverrides },
      agentKindOverride: { ...get().agentKindOverride, ...agentKindOverrides },
    }));
    await dbSetSetting(tauriDatabase, SETTING_LAST_SESSION_ID, session.id);

    if (attachmentInputs && attachmentInputs.length > 0) {
      await get().addGoalAttachments({ type: 'session', id: session.id }, attachmentInputs);
    }

    if (workflowId) {
      void get().reprocessGoalForWorkflow(session.id);
    }

    if (firstStepPromptPrefix.length > 0) {
      void get().sendTurn({ sessionId: session.id, content: firstStepPromptPrefix });
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
