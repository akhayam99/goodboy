import type { SessionId, WorkflowRunId } from '@goodboy/types';
import type { AppStore } from '../../store/store';
import { selectActiveMount } from '../../store/slices/project-mounts/selectors';
import {
  childRoutingBatch,
  type ChildRoutingBatch,
} from '../../store/slices/workflows/childRoutingBatch';
import { PROVIDER_LABEL, modelLabel } from '../chat/utils/chat-constants';
import { exploreList, exploreRead } from '../explore/explore';
import { kindRouting } from '../session/agent-kind';
import { workflowAvailabilitySnapshot } from '../workflows/workflowAvailabilitySnapshot';
import {
  collectWireframeScoutRootCandidates,
  pinWireframeScoutRoot,
} from './pinWireframeScoutRoot';
import {
  WIREFRAME_SCOUT_SKIP_BUDGET,
  WIREFRAME_SCOUT_SKIP_NO_MOUNT,
  wireframeScoutSkipRouting,
  type WireframeScoutPlan,
} from './wireframeScoutPlan';
import { WIREFRAME_SCOUTS } from './wireframeScoutRoles';

export type WireframeScoutGate =
  | Readonly<{ kind: 'skipped'; reason: string }>
  | Readonly<{
      kind: 'ready';
      worktreePath: string;
      modelLabel: string;
      routing: ChildRoutingBatch;
    }>;

type GateParams = Readonly<{
  state: AppStore;
  sessionId: SessionId;
  workflowRunId: WorkflowRunId | null;
}>;

export const wireframeScoutGate = ({
  state,
  sessionId,
  workflowRunId,
}: GateParams): WireframeScoutGate => {
  const mount = selectActiveMount({ state, sessionId });
  if (mount === null || mount.worktreePath.length === 0) {
    return { kind: 'skipped', reason: WIREFRAME_SCOUT_SKIP_NO_MOUNT };
  }
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
  if (usable.length === 0) {
    return { kind: 'skipped', reason: WIREFRAME_SCOUT_SKIP_BUDGET };
  }
  const routing = childRoutingBatch({
    state,
    sessionId,
    workflowRunId,
    role: 'scout',
    requests: WIREFRAME_SCOUTS.map((scout) => ({
      proposal: null,
      promptText: `${scout.name}\n${scout.scope}`,
      childLock: null,
    })),
  });
  if (routing.kind === 'blocked') {
    return { kind: 'skipped', reason: wireframeScoutSkipRouting({ reason: routing.reason }) };
  }
  const session = state.sessions?.find((entry) => entry.id === sessionId) ?? null;
  const roleModels =
    session === null ? undefined : state.workspaceOverrides?.[session.workspaceId]?.roleModels;
  const fallback = kindRouting({ kind: 'scout', roleModels });
  const first = routing.entries[0];
  const provider = first?.providerOverride ?? fallback.provider;
  const model = first?.modelOverride ?? fallback.model;
  return {
    kind: 'ready',
    worktreePath: mount.worktreePath,
    modelLabel: `${PROVIDER_LABEL[provider]} ${modelLabel(model)}`,
    routing,
  };
};

type PlanParams = Readonly<{
  state: AppStore;
  sessionId: SessionId;
  workflowRunId: WorkflowRunId | null;
  goal: string;
  brief: string | null;
}>;

export type WireframeScoutPlanResult = Readonly<{
  plan: WireframeScoutPlan;
  gate: WireframeScoutGate;
}>;

export const collectWireframeScoutPlan = async ({
  state,
  sessionId,
  workflowRunId,
  goal,
  brief,
}: PlanParams): Promise<WireframeScoutPlanResult> => {
  const gate = wireframeScoutGate({ state, sessionId, workflowRunId });
  if (gate.kind === 'skipped') {
    return { plan: { kind: 'skipped', reason: gate.reason }, gate };
  }
  const sessionDir = gate.worktreePath;
  const candidates = await collectWireframeScoutRootCandidates({
    list: ({ relPath }) => exploreList({ sessionDir, relPath }),
    read: async ({ relPath }) => {
      const content = await exploreRead({ sessionDir, relPath });
      return content.type === 'text' ? content.text : null;
    },
  }).catch(() => []);
  const pinned = pinWireframeScoutRoot({ candidates, goal, brief });
  return {
    plan: {
      kind: 'ready',
      root: pinned.path,
      rootReason: pinned.reason,
      scouts: WIREFRAME_SCOUTS,
      modelLabel: gate.modelLabel,
    },
    gate,
  };
};
