import { autoModelForRole, resolveRoleRouting, runsForWorkflowRun } from '@goodboy/core';
import { formatError } from '@goodboy/ui';
import type {
  AgentEffort,
  AgentId,
  IsoDateTime,
  ProviderId,
  SessionId,
  WorkflowRunId,
} from '@goodboy/types';
import {
  artifactEvidenceInventory,
  recordArtifactProvenance,
} from '../../../features/artifacts/artifactProvenance';
import { buildWireframeContext } from '../../../features/wireframes/buildWireframeContext';
import { collectWireframeDesignProfile } from '../../../features/wireframes/collectWireframeDesignProfile';
import { describeDesignProfile } from '../../../features/wireframes/describeDesignProfile';
import {
  WIREFRAME_FIDELITY_LABEL,
  type WireframeFidelity,
} from '../../../features/wireframes/wireframeFidelity';
import { workflowAvailabilitySnapshot } from '../../../features/workflows/workflowAvailabilitySnapshot';
import type { SpawnFocus } from '../session-view/spawnFocus';
import type { GetFn } from './types';

export type WireframeRouting = {
  readonly provider: ProviderId;
  readonly model: string;
  readonly effort: AgentEffort;
};

export type SpawnWireframeAgentParams = {
  readonly sessionId: SessionId;
  readonly fidelity: WireframeFidelity;
  readonly workflowRunId?: WorkflowRunId | null;
  readonly routing?: WireframeRouting | null;
  readonly brief?: string | null;
  readonly evidence?: string | null;
  readonly focus?: SpawnFocus;
};

type State = ReturnType<GetFn>;

type RoutingParams = {
  readonly state: State;
  readonly sessionId: SessionId;
  readonly fidelity: WireframeFidelity;
  readonly picked: WireframeRouting | null;
};

export const resolveWireframeRouting = ({
  state,
  sessionId,
  fidelity,
  picked,
}: RoutingParams): WireframeRouting => {
  if (picked !== null) {
    return picked;
  }
  const session = state.sessions?.find((entry) => entry.id === sessionId) ?? null;
  const overrides =
    session === null ? null : (state.workspaceOverrides?.[session.workspaceId] ?? null);
  const role = resolveRoleRouting({ role: 'wireframe', prefs: overrides?.roleModels });
  if (role.isOverride) {
    return { provider: role.provider, model: role.model, effort: role.effort };
  }
  const effort: AgentEffort = fidelity === 'high' ? 'high' : 'medium';
  const availability = workflowAvailabilitySnapshot({
    providers: state.providers ?? [],
    cooldowns: state.providerCooldowns ?? {},
    alerts: state.budgetAlerts ?? [],
    sessionId,
    isRunBudgetBlocked: false,
    nowMs: Date.now(),
  });
  const usable = availability.connectedProviders.filter(
    (provider) =>
      !availability.coolingDownProviders.includes(provider) &&
      !availability.budgetBlockedProviders.includes(provider),
  );
  const choice = autoModelForRole({
    role: 'wireframe',
    providers: usable,
    prefs: overrides?.roleModels,
  });
  if (choice === null) {
    return { provider: role.provider, model: role.model, effort };
  }
  return { provider: choice.provider, model: choice.model, effort };
};

export const spawnWireframeAgent = (get: GetFn) => {
  return async ({
    sessionId,
    fidelity,
    workflowRunId = null,
    routing = null,
    brief = null,
    evidence = null,
    focus = 'agent',
  }: SpawnWireframeAgentParams): Promise<AgentId> => {
    const state = get();
    const session = state.sessions?.find((entry) => entry.id === sessionId) ?? null;
    if (session === null) {
      throw new Error(`session not found: ${sessionId}`);
    }
    const resolved = resolveWireframeRouting({ state, sessionId, fidelity, picked: routing });
    const name = WIREFRAME_FIDELITY_LABEL[fidelity];
    if (evidence !== null && evidence.trim().length > 0) {
      return get().spawnAgent(sessionId, {
        kindOverride: 'wireframe',
        name,
        provider: resolved.provider,
        model: resolved.model,
        effort: resolved.effort,
        initialPrompt: evidence,
        focus,
      });
    }
    const designProfile =
      fidelity === 'high' ? await collectWireframeDesignProfile({ state, sessionId }) : null;
    const sessionAgents = state.sessionPhaseRuns?.[sessionId] ?? [];
    const scoped =
      workflowRunId === null ? sessionAgents : runsForWorkflowRun(sessionAgents, workflowRunId);
    const context = buildWireframeContext({
      fidelity,
      brief,
      session,
      agents: scoped,
      transcripts: state.transcripts ?? {},
      artifacts: state.sessionArtifacts?.[sessionId] ?? [],
      designProfile,
      capturedAt: new Date().toISOString() as IsoDateTime,
    });
    const agentId = await get().spawnAgent(sessionId, {
      kindOverride: 'wireframe',
      name,
      provider: resolved.provider,
      model: resolved.model,
      effort: resolved.effort,
      initialPrompt: context.text,
      focus,
    });
    await recordArtifactProvenance({
      agentId,
      sessionId,
      kind: 'wireframe',
      brief,
      evidence: artifactEvidenceInventory({
        sourceIds: context.sourceIds,
        session,
        agents: sessionAgents,
        artifacts: state.sessionArtifacts?.[sessionId] ?? [],
        sourceWorkflowRunId: workflowRunId,
      }),
      omissions: context.truncations,
      designProfileSummary:
        designProfile === null ? null : describeDesignProfile({ profile: designProfile }),
      sourceWorkflowRunId: workflowRunId,
      executingWorkflowRunId: null,
    }).catch((error: unknown) => {
      console.warn(`[artifact-provenance] wireframe ${agentId}: ${formatError(error)}`);
    });
    return agentId;
  };
};
