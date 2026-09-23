import type { MountId, SessionId } from '@goodboy/types';
import type { AppStore } from '../../store/store';
import { resolveArtifactMounts, type ArtifactMountOption } from '../artifacts/artifactMountChoice';
import {
  childRoutingBatch,
  type ChildRoutingBatch,
} from '../../store/slices/workflows/childRoutingBatch';
import { modelLabel } from '../chat/utils/chat-constants';
import { PROVIDER_LABEL } from '../providers/providerLabel';
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
  type WireframeScoutRoot,
} from './wireframeScoutPlan';
import { WIREFRAME_SCOUTS } from './wireframeScoutRoles';
import { selectResolvedSettings } from '../../store/slices/overrides/selectResolvedSettings';

export type WireframeScoutGate =
  | Readonly<{ kind: 'skipped'; reason: string }>
  | Readonly<{
      kind: 'ready';
      mounts: ReadonlyArray<ArtifactMountOption>;
      modelLabel: string;
      routing: ChildRoutingBatch;
    }>;

type GateParams = Readonly<{
  state: AppStore;
  sessionId: SessionId;
  mountIds: ReadonlyArray<MountId>;
}>;

export const wireframeScoutGate = ({
  state,
  sessionId,
  mountIds,
}: GateParams): WireframeScoutGate => {
  const mounts = resolveArtifactMounts({ state, sessionId, mountIds });
  if (mounts.length === 0) {
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
  if (availability.isSessionBudgetBlocked) {
    return { kind: 'skipped', reason: WIREFRAME_SCOUT_SKIP_BUDGET };
  }
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
  const roleModels = selectResolvedSettings({ state, sessionId })?.roleModels ?? null;
  const fallback = kindRouting({ kind: 'scout', roleModels });
  const first = routing.entries[0];
  const provider = first?.providerOverride ?? fallback.provider;
  const model = first?.modelOverride ?? fallback.model;
  return {
    kind: 'ready',
    mounts,
    modelLabel: `${PROVIDER_LABEL[provider]} ${modelLabel(model)}`,
    routing,
  };
};

type PlanParams = Readonly<{
  state: AppStore;
  sessionId: SessionId;
  mountIds: ReadonlyArray<MountId>;
  goal: string;
  brief: string | null;
}>;

export type WireframeScoutPlanResult = Readonly<{
  plan: WireframeScoutPlan;
  gate: WireframeScoutGate;
}>;

const pinnedRootOf = async ({
  mount,
  goal,
  brief,
}: Readonly<{
  mount: ArtifactMountOption;
  goal: string;
  brief: string | null;
}>): Promise<WireframeScoutRoot> => {
  const sessionDir = mount.worktreePath;
  const candidates = await collectWireframeScoutRootCandidates({
    list: ({ relPath }) => exploreList({ sessionDir, relPath }),
    read: async ({ relPath }) => {
      const content = await exploreRead({ sessionDir, relPath });
      return content.type === 'text' ? content.text : null;
    },
  }).catch(() => []);
  const pinned = pinWireframeScoutRoot({ candidates, goal, brief });
  return {
    mountId: mount.mountId,
    mountName: mount.mountName,
    worktreePath: mount.worktreePath,
    root: pinned.path,
    rootReason: pinned.reason,
  };
};

export const collectWireframeScoutPlan = async ({
  state,
  sessionId,
  mountIds,
  goal,
  brief,
}: PlanParams): Promise<WireframeScoutPlanResult> => {
  const gate = wireframeScoutGate({ state, sessionId, mountIds });
  if (gate.kind === 'skipped') {
    return { plan: { kind: 'skipped', reason: gate.reason }, gate };
  }
  const roots: Array<WireframeScoutRoot> = [];
  for (const mount of gate.mounts) {
    roots.push(await pinnedRootOf({ mount, goal, brief }));
  }
  return {
    plan: {
      kind: 'ready',
      roots,
      scouts: WIREFRAME_SCOUTS,
      modelLabel: gate.modelLabel,
    },
    gate,
  };
};
