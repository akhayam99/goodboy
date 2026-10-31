import type {
  Agent,
  AttachmentInput,
  IsoDateTime,
  OrchestratorRouting,
  ProviderId,
  SessionId,
  WorkflowId,
  WorkflowExecutionMode,
  WorkflowRun,
  WorkflowRunId,
  WorkflowTriggerMode,
  WorkflowRules,
} from '@goodboy/types';
import {
  attachWorkflowToSession as attachWorkflowToSessionInDb,
  detachWorkflowFromSession as detachWorkflowFromSessionInDb,
} from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { selectResolvedSettings } from '../overrides/selectResolvedSettings';
import { workflowAvailabilitySnapshot } from '../../../features/workflows/workflowAvailabilitySnapshot';
import { workspacePolicyAvailability } from '../providerLimits/workspacePolicyAvailability';
import { preSpawnWorkflowAgents } from './preSpawnWorkflowAgents';
import { selectRoutingScope } from '../agents/selectRoutingScope';
import { persistOrchestrationStop } from './orchestrateNextStep';
import { activateWorkflowAgentOrNotify } from './activateWorkflowAgentOrNotify';
import { generateWorkflowRunTitle } from './generateWorkflowRunTitle';
import { sessionPlace } from '../navigation/place';
import type { GetFn, SetFn } from './types';
import { sessionById } from '../sessions/sessionIndex';
import { resolveWorkflowHeadroom } from './resolveWorkflowHeadroom';
import { withHeadroom } from './withHeadroom';
import { selectHiddenModels } from '../settings/selectHiddenModels';
import { workspaceRulesFor } from './runLimit/workspaceRulesFor';
import { rulesWithLimit, runLimitOf, type WorkflowLimitSource } from './runLimit/runLimitOf';

type Options = {
  autoRun?: boolean;
  goal?: string;
  triggerMode?: Exclude<WorkflowTriggerMode, 'after_run'>;
  attachmentInputs?: ReadonlyArray<AttachmentInput>;
  executionMode?: WorkflowExecutionMode;
  orchestratorRouting?: OrchestratorRouting;
  spendLimitUsd?: number | null;
  limitSource?: WorkflowLimitSource;
  providerPool?: ReadonlyArray<ProviderId>;
  navigate?: boolean;
  rulesSnapshot?: WorkflowRules;
};

export const attachWorkflowToSession = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, workflowId: WorkflowId, options?: Options) => {
    const session = sessionById(get().sessions, sessionId);
    if (!session) {
      throw new Error(`session not found: ${sessionId}`);
    }

    const templates = get().phaseTemplates[session.workspaceId] ?? [];
    const template = templates.find((t) => t.id === workflowId);
    if (!template) {
      throw new Error(`workflow not found: ${workflowId}`);
    }

    const workflowRunId = crypto.randomUUID() as WorkflowRunId;
    const autoRun = options?.autoRun ?? session.autoRun;
    const executionMode = options?.executionMode ?? 'static';
    const goal = options?.goal?.trim() || undefined;
    const orchestratorRouting = options?.orchestratorRouting;
    const providerPool =
      executionMode === 'dynamic' &&
      options?.providerPool != null &&
      options.providerPool.length > 0
        ? options.providerPool
        : undefined;
    const workspaceRules = workspaceRulesFor({ state: get(), workspaceId: session.workspaceId });
    const limit = runLimitOf({
      rules: workspaceRules,
      spendLimitUsd: options?.spendLimitUsd,
      limitSource: options?.limitSource,
    });
    const spendLimitUsd = limit.usd;
    const spendLimitMode = limit.mode;
    const rulesSnapshot = rulesWithLimit({
      rules: options?.rulesSnapshot ?? {
        ...workspaceRules,
        autonomy: autoRun ? 'run' : 'step',
      },
      limit,
    });
    const triggerMode = options?.triggerMode ?? 'immediate';
    const ordinal = session.workflowRuns.reduce((max, r) => Math.max(max, r.ordinal), -1) + 1;
    const now = new Date().toISOString() as IsoDateTime;
    await attachWorkflowToSessionInDb({
      db: tauriDatabase,
      sessionId,
      workflowRunId,
      workflowId,
      autoRun,
      updatedAt: now,
      ...(goal && { goal }),
      triggerMode,
      executionMode,
      ...(orchestratorRouting != null && { orchestratorRouting }),
      ...(spendLimitUsd != null && { spendLimitUsd }),
      spendLimitMode,
      ...(providerPool != null && { providerPool }),
      rulesSnapshot,
    });

    const existingRuns = get().sessionPhaseRuns[sessionId] ?? [];
    const baseOrdinal = existingRuns.reduce((max, r) => Math.max(max, r.ordinal), -1);
    const sessionDefaultProvider = (session.providerOverride ??
      session.providerPreference.defaultProvider) as ProviderId;
    const roleModels = selectResolvedSettings({ state: get(), sessionId })?.roleModels ?? null;
    const headroom =
      executionMode === 'dynamic'
        ? null
        : await resolveWorkflowHeadroom({ get, sessionId, rules: rulesSnapshot });
    const spawned = await (
      executionMode === 'dynamic'
        ? Promise.resolve({
            agents: [] as ReadonlyArray<Agent>,
            modelOverrides: {},
            kindOverrides: {},
            providerOverrides: {},
            effortOverrides: {},
            blocked: [],
          })
        : preSpawnWorkflowAgents({
            scope: withHeadroom({
              scope: selectRoutingScope({ state: get(), sessionId }),
              headroom,
            }),
            sessionId,
            workflowRunId,
            mountId: null,
            steps: template.steps,
            baseOrdinal: baseOrdinal + 1,
            defaultProvider: sessionDefaultProvider,
            roleModels,
            sessionModel: session.modelOverride ?? null,
            sessionEffort: session.effort ?? null,
            availability: workflowAvailabilitySnapshot({
              providers: get().providers ?? [],
              cooldowns: get().providerCooldowns ?? {},
              alerts: get().budgetAlerts ?? [],
              hidden: selectHiddenModels({ state: get() }),
              sessionId,
              isRunBudgetBlocked: false,
              nowMs: Date.now(),
              ...workspacePolicyAvailability({ state: get(), sessionId }),
              headroom,
            }),
          })
    ).catch(async (error: unknown) => {
      await detachWorkflowFromSessionInDb(tauriDatabase, sessionId, workflowRunId, now).catch(
        () => undefined,
      );
      throw error;
    });
    const newAgents = spawned.agents;

    const newRun: WorkflowRun = {
      id: workflowRunId,
      workflowId,
      ordinal,
      currentStep: 0,
      autoRun,
      triggerMode,
      executionMode,
      createdAt: now,
      ...(orchestratorRouting != null && { orchestratorRouting }),
      ...(goal && { goal }),
      ...(spendLimitUsd != null && { spendLimitUsd }),
      spendLimitMode,
      ...(providerPool != null && { providerPool }),
      rulesSnapshot,
    };

    const transcriptEntries: Record<string, ReadonlyArray<never>> = {};
    const turnStateEntries: Record<string, { kind: 'draft' }> = {};
    for (const agent of newAgents) {
      transcriptEntries[agent.id] = [];
      turnStateEntries[agent.id] = { kind: 'draft' };
    }

    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId
          ? { ...s, workflowRuns: [...s.workflowRuns, newRun], updatedAt: now }
          : s,
      ),
      sessionWorkflows: {
        ...state.sessionWorkflows,
        [sessionId]: (state.sessionWorkflows[sessionId] ?? []).some((w) => w.id === workflowId)
          ? (state.sessionWorkflows[sessionId] ?? [])
          : [...(state.sessionWorkflows[sessionId] ?? []), template],
      },
      sessionPhaseRuns: {
        ...state.sessionPhaseRuns,
        [sessionId]: [...existingRuns, ...newAgents],
      },
      transcripts: { ...state.transcripts, ...transcriptEntries },
      agentTurnState: { ...state.agentTurnState, ...turnStateEntries },
      agentModelOverride: { ...state.agentModelOverride, ...spawned.modelOverrides },
      agentKindOverride: { ...state.agentKindOverride, ...spawned.kindOverrides },
      agentProviderOverride: { ...state.agentProviderOverride, ...spawned.providerOverrides },
      agentEffortOverride: { ...state.agentEffortOverride, ...spawned.effortOverrides },
      focusedWorkflowRunId: { ...state.focusedWorkflowRunId, [sessionId]: workflowRunId },
    }));

    const firstBlocked = spawned.blocked[0];
    if (firstBlocked != null) {
      await persistOrchestrationStop({
        set,
        sessionId,
        workflowRunId,
        stop: { kind: 'failure', message: firstBlocked.reason },
      });
    }

    if (options?.navigate === true) {
      get().navigate({ to: sessionPlace({ sessionId, lens: 'workflows' }) });
    }

    const attachmentInputs = options?.attachmentInputs;
    if (attachmentInputs && attachmentInputs.length > 0) {
      await get().addGoalAttachments({ type: 'workflow_run', id: workflowRunId }, attachmentInputs);
    }

    void get().reprocessGoalForWorkflow(sessionId);

    if (goal != null && template.origin !== 'orchestrated') {
      void generateWorkflowRunTitle({ set, get, sessionId, workflowRunId });
    }

    if (triggerMode === 'immediate') {
      if (executionMode === 'dynamic' && autoRun) {
        void get().maybeAutoAdvanceWorkflow(sessionId);
      } else if (executionMode === 'dynamic') {
        void get().orchestrateNextStep(sessionId, workflowRunId);
      } else if (autoRun) {
        void get().maybeAutoAdvanceWorkflow(sessionId);
      } else if (newAgents.length > 0 && firstBlocked == null) {
        void activateWorkflowAgentOrNotify({
          get,
          sessionId,
          agentId: newAgents[0]!.id,
          focus: 'none',
        });
      }
    }
  };
};
