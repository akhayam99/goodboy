import { invoke } from '@tauri-apps/api/core';
import {
  OrchestratorClient,
  orchestratorModelPool,
  resolveTaskModel,
  type OrchestratorAllowances,
  type OrchestratorDecision,
} from '@goodboy/core';
import {
  GENERATION_REPAIR_ATTEMPT_CAP,
  GENERATION_RUN_CAP,
  GENERATION_STRUCTURAL_REPLAN_CAP,
  type ProviderId,
  type SessionId,
} from '@goodboy/types';
import { workflowAvailabilitySnapshot } from '../../../features/workflows/workflowAvailabilitySnapshot';
import {
  inferAgentKindFromName,
  KIND_TO_ROLE,
  type AgentKind,
} from '../../../features/session/agent-kind';
import { issuedAgentInventory } from '../turn/agentEvidenceInventory';
import { getSessionRepo } from '../worktrees/getSessionRepo';
import { applyNeedDisposition, type NeedDispositionOutcome } from './applyNeedDisposition';
import {
  buildEvidenceExcerpts,
  buildNeedRequest,
  buildUnresolvedObligations,
} from './buildNeedPacket';
import { resolveInvocationLimits } from '../../../shared/lib/invocationAdmission';
import { spentUsdForRun } from './budgetBlock';
import { recordOrchestratorUsage } from './recordOrchestratorUsage';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly sessionId: SessionId;
  readonly obligationId: string;
};

const allowancesFor = ({
  get,
  sessionId,
  obligationId,
}: {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly obligationId: string;
}): OrchestratorAllowances => {
  const generated = (get().sessionPhaseRuns[sessionId] ?? []).filter(
    (agent) => agent.executionPurpose === 'capability' || agent.executionPurpose === 'fan-out',
  ).length;
  const attempts = (get().capabilityGrants[sessionId] ?? []).filter(
    (grant) => grant.obligationId === obligationId,
  ).length;
  const replans = (get().capabilityGrants[sessionId] ?? []).filter(
    (grant) => grant.purpose === 'replan',
  ).length;
  return {
    generationRemaining: Math.max(0, GENERATION_RUN_CAP - generated),
    repairAttemptsRemaining: Math.max(0, GENERATION_REPAIR_ATTEMPT_CAP - attempts),
    structuralReplansRemaining: Math.max(0, GENERATION_STRUCTURAL_REPLAN_CAP - replans),
    spendRemainingUsd: null,
  };
};

export const decideCapabilityNeed = ({
  set,
  get,
}: {
  readonly set: SetFn;
  readonly get: GetFn;
}) => {
  return async ({ sessionId, obligationId }: Params): Promise<NeedDispositionOutcome> => {
    const obligation = (get().capabilityObligations[sessionId] ?? []).find(
      (candidate) => candidate.id === obligationId,
    );
    if (obligation === undefined) {
      return { kind: 'unavailable', reason: 'the obligation is not loaded for this session' };
    }
    if (obligation.state !== 'open') {
      return { kind: 'unavailable', reason: 'the obligation is no longer open' };
    }
    const agents = get().sessionPhaseRuns[sessionId] ?? [];
    const requester = agents.find((agent) => agent.id === obligation.requesterAgentId);
    const session = get().sessions.find((candidate) => candidate.id === sessionId);
    if (requester === undefined || session === undefined) {
      return { kind: 'unavailable', reason: 'the requesting agent is no longer loaded' };
    }
    const kind =
      (requester.kind as AgentKind | undefined) ??
      get().agentKindOverride[requester.id] ??
      inferAgentKindFromName(requester.name);
    const pendingRequest = buildNeedRequest({
      obligation,
      requester,
      requesterRole: KIND_TO_ROLE[kind],
    });
    if (pendingRequest === null) {
      return { kind: 'unavailable', reason: 'the obligation carries no recorded request' };
    }
    const { inventory } = issuedAgentInventory({ get, sessionId, agentId: requester.id });
    const defaultProvider = (session.providerOverride ??
      session.providerPreference.defaultProvider) as ProviderId;
    const routing = resolveTaskModel({
      task: 'workflow_orchestrator',
      preferences: get().workspaceOverrides?.[session.workspaceId]?.taskModels,
      workspaceDefaultProviderId:
        get().workspaceOverrides?.[session.workspaceId]?.defaultProviderId,
      sessionDefaultProviderId: defaultProvider,
    });
    const availability = workflowAvailabilitySnapshot({
      providers: get().providers ?? [],
      cooldowns: get().providerCooldowns ?? {},
      alerts: get().budgetAlerts ?? [],
      sessionId,
      isRunBudgetBlocked: false,
      nowMs: Date.now(),
    });
    const run = session.workflowRuns.find((candidate) => candidate.id === obligation.workflowRunId);
    const worktreePath = getSessionRepo({ get, sessionId })?.worktreePath ?? null;
    const graph = (get().clusterExecutionGraphs?.[sessionId] ?? []).find(
      (candidate) => candidate.containerAgentId === requester.parentAgentId,
    );
    const providerIdentity =
      get().workspaceOverrides[session.workspaceId]?.providerBindings?.[routing.providerId] ??
      get().authResults?.[routing.providerId]?.identity ??
      null;
    const client = new OrchestratorClient({
      ...routing,
      invokeFn: invoke,
      ...(worktreePath !== null && { workingDir: worktreePath }),
      invocation: {
        invocationId: crypto.randomUUID(),
        workspaceId: session.workspaceId,
        sessionId,
        ...(obligation.workflowRunId !== null && { workflowRunId: obligation.workflowRunId }),
        agentId: requester.id,
        ...(providerIdentity != null && { providerIdentity }),
        purpose: 'orchestrator',
        isHeavyweight: false,
        limits: resolveInvocationLimits({
          providerId: routing.providerId,
          workspaceOverride: get().workspaceOverrides[session.workspaceId],
        }),
      },
      onUsage: (usage) =>
        recordOrchestratorUsage({
          set,
          get,
          sessionId,
          agentId: requester.id,
          workflowRunId: obligation.workflowRunId,
          provider: routing.providerId,
          model: usage.model ?? routing.model,
          usage,
        }),
    });
    let decision: OrchestratorDecision | null = null;
    try {
      const result = await client.decide({
        goal: session.goal,
        processText: '',
        completedSteps: [],
        openQuestionCount: 0,
        providerId: defaultProvider,
        modelMenu: orchestratorModelPool({ availability }),
        roleDefaults: [],
        stepsUsed: agents.length,
        pendingRequest,
        evidenceExcerpts: buildEvidenceExcerpts({
          inventory,
          evidenceRefs: pendingRequest.evidenceRefs,
        }),
        unresolvedObligations: buildUnresolvedObligations({
          obligations: get().capabilityObligations[sessionId] ?? [],
          agents,
          excludeObligationId: obligation.id,
        }),
        ...(graph !== undefined && {
          graphRevision: `${graph.containerAgentId}@r${graph.revision}`,
        }),
        allowances: {
          ...allowancesFor({ get, sessionId, obligationId }),
          ...(run?.spendLimitUsd != null && {
            spendRemainingUsd: Math.max(
              0,
              run.spendLimitUsd - spentUsdForRun({ get, sessionId, run }),
            ),
          }),
        },
      });
      decision = result.decision;
    } catch {
      return {
        kind: 'unavailable',
        reason: `${routing.providerId}/${routing.model} could not decide on this need`,
      };
    }
    if (
      decision === null ||
      decision.action !== 'need' ||
      decision.obligationId !== obligation.id
    ) {
      void get().emitNotification(
        'error',
        'warning',
        `need undecided: ${requester.name}`,
        'the orchestrator did not answer this need, so it stays open and unowned. retry it or resolve it by hand.',
        { sessionId },
      );
      return { kind: 'unavailable', reason: 'the orchestrator did not answer this need' };
    }
    return applyNeedDisposition({ set, get, sessionId, obligation, decision });
  };
};
