import type {
  Agent,
  AttachmentInput,
  IsoDateTime,
  ModelEffort,
  ProjectId,
  ProviderId,
  Session,
  SessionId,
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
  deleteSession,
  insertSession,
  getWorkspaceById,
  listProjectsForWorkspace,
  upsertSessionExternalTask,
  setSetting as dbSetSetting,
  upsertContextSlot,
} from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { invokeAgentInsert } from '../../../features/workflows/workflows';
import { kindRouting, AGENT_KIND_META, type AgentKind } from '../../../features/session/agent-kind';
import { SETTING_LAST_SESSION_ID } from '../../../features/settings/settings';
import { markSessionMobileShared } from '../../../features/companion/mobileConfinement';
import { workSurfaceFocus } from '../session-view/workSurfaceFocus';
import { clampTitle } from './titleLimit';
import { preSpawnWorkflowAgents } from '../workflows/preSpawnWorkflowAgents';
import { discardUncreatedSession } from './discardUncreatedSession';
import { rememberMaterializationSeed } from './materializationSeeds';
import { resolveSessionProject } from './resolveSessionProject';
import type { GetFn, SetFn } from './types';

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
  projectId?: ProjectId;
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
  omitGoalSlot?: boolean;
};

export const createSession = (set: SetFn, get: GetFn) => {
  return async ({
    workspaceId,
    projectId,
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
    omitGoalSlot = false,
  }: Input): Promise<{ session: Session }> => {
    const workspace = await getWorkspaceById({ db: tauriDatabase, id: workspaceId });
    if (workspace === null) {
      throw new Error(`workspace not found: ${workspaceId}`);
    }
    const projects = await listProjectsForWorkspace({ db: tauriDatabase, workspaceId });
    const project = projectId !== undefined ? resolveSessionProject({ projects, projectId }) : null;

    const trimmedPrefix = branchPrefix?.trim();
    const trimmedBranchSlug = branchSlug?.trim();
    const trimmedExisting = existingBranch?.trim();
    const trimmedFallbackRef = fallbackRef?.trim();
    const trimmedFolderName = folderName?.trim();
    const sessionId = crypto.randomUUID() as SessionId;
    if (mobileShared) {
      markSessionMobileShared(sessionId);
    }
    const existingSeparator = trimmedExisting?.lastIndexOf('/') ?? -1;
    const existingPrefix =
      existingSeparator > 0 ? trimmedExisting?.slice(0, existingSeparator) : undefined;
    rememberMaterializationSeed({
      sessionId,
      seed: {
        ...(trimmedPrefix !== undefined && trimmedPrefix !== ''
          ? { branchPrefix: trimmedPrefix }
          : existingPrefix !== undefined
            ? { branchPrefix: existingPrefix }
            : {}),
        ...(trimmedBranchSlug !== undefined && trimmedBranchSlug !== ''
          ? { sessionSlug: trimmedBranchSlug }
          : trimmedExisting !== undefined && trimmedExisting !== ''
            ? { sessionSlug: trimmedExisting }
            : {}),
        ...(trimmedExisting !== undefined && trimmedExisting !== ''
          ? { existingBranch: trimmedExisting }
          : {}),
        ...(trimmedFallbackRef !== undefined && trimmedFallbackRef !== ''
          ? { fallbackRef: trimmedFallbackRef }
          : {}),
        ...(trimmedFolderName !== undefined && trimmedFolderName !== ''
          ? { folderName: trimmedFolderName }
          : {}),
      },
    });

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
      goal: clampTitle(goal.trim()),
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
    set((state) => ({
      sessions:
        state.currentWorkspaceId === workspaceId ? [session, ...state.sessions] : state.sessions,
      projects:
        project == null || state.projects.some((candidate) => candidate.id === project.id)
          ? state.projects
          : [...state.projects, project],
      sessionWorktrees: { ...state.sessionWorktrees, [session.id]: [] },
      sessionProjectMounts: { ...state.sessionProjectMounts, [session.id]: [] },
      sessionBranches: { ...state.sessionBranches, [session.id]: '' },
    }));
    if (project != null) {
      try {
        await get().materializeProject({
          sessionId: session.id,
          projectId: project.id,
          reason:
            trimmedExisting !== undefined && trimmedExisting !== ''
              ? `adopted existing branch ${trimmedExisting}`
              : 'the session works in this project',
          taskIdentifiers: (externalTasks ?? []).map((task) => task.identifier),
        });
      } catch (error) {
        await discardUncreatedSession({ set, sessionId: session.id });
        throw error;
      }
    }

    const externalTaskRows: Array<SessionExternalTask> = [];
    for (const externalTask of externalTasks ?? []) {
      const row: SessionExternalTask = {
        sessionId: session.id,
        ...(externalTask.projectId != null ? { projectId: externalTask.projectId } : {}),
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
    for (const row of externalTaskRows) {
      await get().recordSessionEvent({
        sessionId: session.id,
        kind: 'external_task_created',
        payload: {
          provider: row.provider,
          externalId: row.externalId,
          identifier: row.identifier,
          title: row.title,
          url: row.url,
          ...(row.projectId != null ? { projectId: row.projectId } : {}),
        },
      });
    }

    const goalText = omitGoalSlot ? '' : goal.trim();
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
          sessionEffort: session.effort ?? null,
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
    const transcriptEntries: Record<string, ReadonlyArray<never>> = {};
    const turnStateEntries: Record<string, { kind: 'draft' }> = {};
    for (const agent of prespawnedRuns) {
      transcriptEntries[agent.id] = [];
      turnStateEntries[agent.id] = { kind: 'draft' };
    }

    set((state) => ({
      currentSessionId: session.id,
      sessionSummary: null,
      sessionExternalTasks: {
        ...state.sessionExternalTasks,
        [session.id]: externalTaskRows,
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

    return { session };
  };
};
