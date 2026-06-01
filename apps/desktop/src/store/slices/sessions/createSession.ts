import type {
  Agent,
  IsoDateTime,
  Session,
  SessionId,
  SessionExternalTask,
  SessionProviderPreference,
  TurnState,
  WorkflowId,
  WorkspaceId,
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

interface Input {
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
}

export function createSession(set: SetFn, get: GetFn) {
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
    if (!workspace) throw new Error(`workspace not found: ${workspaceId}`);

    const prefix = branchPrefix?.trim() || 'kay';
    const slugSeed =
      branchSlug?.trim() || (goal.trim().length > 0 ? goal : `session-${Date.now()}`);
    const trimmedExisting = existingBranch?.trim();
    const worktree = await createWorktree({
      repoPath: workspace.rootPath,
      branchPrefix: prefix,
      slug: slugSeed,
      ...(trimmedExisting ? { existingBranch: trimmedExisting } : {}),
    });

    // Make sure workspace overrides are cached before reading defaultProviderId,
    // otherwise a fresh boot would silently fall back to anthropic for the
    // first session created against a workspace.
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
    const session: Session = {
      id: crypto.randomUUID() as SessionId,
      workspaceId,
      goal: goal.trim() || worktree.slug,
      state: initialState,
      contextSlots: [],
      providerPreference: providerPreference ?? inheritedPreference,
      permissionMode: 'bypassPermissions',
      workflowIds: workflowId !== undefined ? [workflowId] : [],
      currentStepByWorkflow: {},
      autoRun: autoRun === true && workflowId !== undefined,
      titleUserEdited: false,
      userStatus: 'wip',
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
        // non-fatal: session is usable without the issue link
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

    // Seed the goal context slot so the session prompt carries the user's
    // stated goal from turn 1. Otherwise the goal lives only on the session
    // row and never reaches the model unless the user retypes it in the
    // context panel.
    const goalText = session.goal.trim();
    if (goalText.length > 0) {
      await upsertContextSlot(tauriDatabase, session.id, {
        key: 'goal',
        value: goalText,
        enabled: true,
      });
    }

    // Pre-create all workflow agents so the sidebar shows the full plan as a
    // progress tracker. Only the first step fires sendTurn; the rest stay
    // pending until the user (or autoRun) advances. Ad-hoc agents spawned
    // later appear in a separate "Agents" block below the workflow block.
    let prespawnedRuns: ReadonlyArray<Agent>;
    let firstStepPromptPrefix = '';
    const agentModelOverrides: Record<string, string> = {};
    const agentKindOverrides: Record<string, string> = {};

    // Seed L2 (per-agent) verbosity from the workspace default at insert time
    // so each new chat starts with the user's workspace setting baked in.
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
      if (model !== null) agentModelOverrides[singleAgent.id] = model;
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
        [session.id]: [worktree.worktreePath],
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

    if (workflowId) void get().reprocessGoalForWorkflow(session.id);

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
}
