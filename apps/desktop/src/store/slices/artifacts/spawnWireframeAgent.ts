import { autoModelForRole, resolveRoleRouting } from '@goodboy/core';
import { formatError } from '@goodboy/ui';
import type { AgentEffort, AgentId, ProviderId, SessionId, WorkflowRunId } from '@goodboy/types';
import type { ArtifactAttachment } from '../../../features/artifacts/artifactAttachments';
import { recordArtifactProvenance } from '../../../features/artifacts/artifactProvenance';
import { prepareArtifactEvidence } from '../../../features/artifacts/prepareArtifactEvidence';
import { collectWireframeScoutPlan } from '../../../features/wireframes/collectWireframeScoutPlan';
import { WIREFRAME_SCOUT_DEADLINE_MS } from '../../../features/wireframes/wireframeScoutReports';
import { sessionGoalText } from '../../../features/artifacts/sessionGoalText';
import {
  WIREFRAME_FIDELITY_LABEL,
  type WireframeFidelity,
} from '../../../features/wireframes/wireframeFidelity';
import type { WireframeTarget } from '../../../features/wireframes/wireframeTarget';
import { workflowAvailabilitySnapshot } from '../../../features/workflows/workflowAvailabilitySnapshot';
import type { SpawnFocus } from '../session-view/spawnFocus';
import type { GetFn } from './types';

export const WIREFRAME_SCOUT_PENDING_NOTE =
  'the scouts had not reported yet when this row was written';

export type WireframeRouting = {
  readonly provider: ProviderId;
  readonly model: string;
  readonly effort: AgentEffort;
};

export type SpawnWireframeAgentParams = {
  readonly sessionId: SessionId;
  readonly fidelity: WireframeFidelity;
  readonly target?: WireframeTarget;
  readonly workflowRunId?: WorkflowRunId | null;
  readonly routing?: WireframeRouting | null;
  readonly brief?: string | null;
  readonly attachments: ReadonlyArray<ArtifactAttachment>;
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
    target = 'both',
    workflowRunId = null,
    routing = null,
    brief = null,
    attachments,
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
    const slots = await state.ensureSessionSlots(sessionId);
    const goal = sessionGoalText({ slots, session });
    const scouting = await collectWireframeScoutPlan({
      state,
      sessionId,
      workflowRunId,
      goal: goal.packText,
      brief,
    });
    if (scouting.plan.kind === 'ready') {
      const containerId = await get().spawnAgent(sessionId, {
        kindOverride: 'wireframe',
        name,
        provider: resolved.provider,
        model: resolved.model,
        effort: resolved.effort,
        focus,
      });
      await recordArtifactProvenance({
        sessionId,
        kind: 'wireframe',
        brief,
        evidence: [],
        omissions: [WIREFRAME_SCOUT_PENDING_NOTE],
        designProfileSummary: null,
        hasDesignEvidence: false,
        phase: 'gathering',
        scoutPlan: [],
        mountIds: scouting.gate.kind === 'ready' ? [scouting.gate.mountId] : [],
        target,
        deadlineAt: Date.now() + WIREFRAME_SCOUT_DEADLINE_MS,
        sourceWorkflowRunId: workflowRunId,
        agentId: containerId,
        executingWorkflowRunId: null,
      }).catch((error: unknown) => {
        console.warn(`[artifact-provenance] wireframe ${containerId}: ${formatError(error)}`);
      });
      const isStarted =
        scouting.gate.kind !== 'ready'
          ? false
          : await get().startWireframeScouts({
              sessionId,
              containerId,
              mounts: [
                {
                  mountId: scouting.gate.mountId,
                  mountName: scouting.gate.mountName,
                  root: scouting.plan.root,
                  worktreePath: scouting.gate.worktreePath,
                },
              ],
              fidelity,
              target,
              workflowRunId,
              brief,
              attachments,
              goal: goal.packText,
            });
      if (isStarted) {
        return containerId;
      }
      const fallback = await prepareArtifactEvidence({
        kind: 'wireframe',
        fidelity,
        target,
        state: get(),
        session,
        workflowRunId,
        brief,
        attachments,
        executingAgentId: containerId,
      });
      await recordArtifactProvenance({
        ...fallback.provenance,
        agentId: containerId,
        executingWorkflowRunId: null,
      }).catch((error: unknown) => {
        console.warn(`[artifact-provenance] wireframe ${containerId}: ${formatError(error)}`);
      });
      void get().sendTurn({ sessionId, agentId: containerId, content: fallback.text });
      return containerId;
    }
    const prepared = await prepareArtifactEvidence({
      kind: 'wireframe',
      fidelity,
      target,
      state,
      session,
      workflowRunId,
      brief,
      attachments,
      executingAgentId: null,
      scoutPlan: scouting.plan,
    });
    const agentId = await get().spawnAgent(sessionId, {
      kindOverride: 'wireframe',
      name,
      provider: resolved.provider,
      model: resolved.model,
      effort: resolved.effort,
      initialPrompt: prepared.text,
      focus,
    });
    await recordArtifactProvenance({
      ...prepared.provenance,
      agentId,
      executingWorkflowRunId: null,
    }).catch((error: unknown) => {
      console.warn(`[artifact-provenance] wireframe ${agentId}: ${formatError(error)}`);
    });
    return agentId;
  };
};
