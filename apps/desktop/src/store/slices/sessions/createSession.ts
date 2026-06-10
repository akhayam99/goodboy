import type {
  Agent,
  IsoDateTime,
  Session,
  SessionId,
  SessionExternalTask,
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
  inferAgentKindFromName,
  type AgentKind,
} from '../../../features/session/agent-kind';
import { SETTING_LAST_SESSION_ID } from '../../../features/settings/settings';
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
  linearIssue?: {
    externalId: string;
    identifier: string;
    url: string;
    title: string;
  };
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
    linearIssue,
  }: Input): Promise<{ session: Session; worktree: CreatedWorktree }> => {
    const workspace = (await listWorkspaces(tauriDatabase)).find((w) => w.id === workspaceId);
    if (!workspace) {
      throw new Error(`workspace not found: ${workspaceId}`);
    }

    const prefix = branchPrefix?.trim() || 'kay';
    const slugSeed =
      branchSlug?.trim() || (goal.trim().length > 0 ? goal : `session-${Date.now()}`);
    const trimmedExisting = existingBranch?.trim();
    const sessionId = crypto.randomUUID() as SessionId;
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
      permissionMode: 'bypassPermissions',
      workflowRuns:
        workflowId !== undefined && workflowRunId !== undefined
          ? [{ id: workflowRunId, workflowId, ordinal: 0, currentStep: 0, autoRun: runAutoRun }]
          : [],
      autoRun: runAutoRun,
      titleUserEdited: false,
      createdAt: now,
      updatedAt: now,
    };
    await insertSession(tauriDatabase, session);
    let externalTask: SessionExternalTask | null = null;
    if (linearIssue) {
      externalTask = {
        sessionId: session.id,
        provider: 'linear',
        externalId: linearIssue.externalId,
        identifier: linearIssue.identifier,
        url: linearIssue.url,
        title: linearIssue.title,
        createdAt: now,
      };
      try {
        await setSessionExternalTask(tauriDatabase, externalTask);
      } catch {
        externalTask = null;
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
          const kind = inferAgentKindFromName(step.name);
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
      sessionExternalTasks: externalTask
        ? { ...state.sessionExternalTasks, [session.id]: externalTask }
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
