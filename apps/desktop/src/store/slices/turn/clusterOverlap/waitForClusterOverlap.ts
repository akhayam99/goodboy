import type { Agent, AgentId, ImplementationCluster, SessionId } from '@goodboy/types';
import { nowIso } from '../../project-mounts/nowIso';
import { applyAgentTurnState } from '../../sessions/sessionMutators';
import { clusterLaunching } from '../../workflows/clusterWaves/clusterLaunching';
import { overlappingRunningParts } from '../../workflows/clusterWaves/overlappingRunningParts';
import { claimTurnStart, ensureTurnStartWindow, isTurnStartCancelled } from '../turnStartWindow';
import type { GetFn, SendTurnInput, SetFn } from '../types';
import { writerWaiters } from '../writerWaiters';

const OVERLAP_POLL_MS = 1000;
const OVERLAP_WAIT_LIMIT_MS = 30 * 60 * 1000;

export type ClusterOverlapOutcome = 'proceed' | 'cancelled' | 'timed_out';

type Params = Readonly<{
  set: SetFn;
  get: GetFn;
  input: SendTurnInput;
}>;

type ClusterParams = Readonly<{
  get: GetFn;
  sessionId: SessionId;
  child: Agent;
}>;

type WaitParams = Readonly<{
  set: SetFn;
  agentId: AgentId;
  sessionId: SessionId;
  blocker: Agent | null;
}>;

const clustersOf = ({
  get,
  sessionId,
  child,
}: ClusterParams): ReadonlyArray<ImplementationCluster> => {
  const consumptions = get().planConsumptions;
  const plan = (get().sessionPlans[sessionId] ?? []).find(
    (candidate) =>
      (candidate.clusters?.length ?? 0) >= 2 &&
      (consumptions[candidate.id] ?? []).some((item) => item.agentId === child.parentAgentId),
  );
  return plan?.clusters ?? [];
};

const blockersOf = ({ get, sessionId, child }: ClusterParams): ReadonlyArray<Agent> => {
  if (child.parentAgentId == null || child.status !== 'pending') {
    return [];
  }
  const children = (get().sessionPhaseRuns[sessionId] ?? [])
    .filter((run) => run.parentAgentId === child.parentAgentId)
    .sort((left, right) => left.ordinal - right.ordinal);
  return overlappingRunningParts({
    children,
    clusters: clustersOf({ get, sessionId, child }),
    childId: child.id,
  });
};

export const waitForClusterOverlap = async ({
  set,
  get,
  input,
}: Params): Promise<ClusterOverlapOutcome> => {
  const { agentId, sessionId } = input;
  const child =
    agentId === undefined
      ? undefined
      : (get().sessionPhaseRuns[sessionId] ?? []).find((run) => run.id === agentId);
  if (agentId === undefined || child === undefined) {
    return 'proceed';
  }
  let blockers = blockersOf({ get, sessionId, child });
  if (blockers.length === 0) {
    return 'proceed';
  }
  clusterLaunching.claim({ childId: agentId });
  ensureTurnStartWindow({ agentId });
  const previous = get().agentTurnState[agentId] ?? {
    kind: 'idle' as const,
    lastActivityAt: nowIso({}),
  };
  const startedAt = nowIso({});
  applyAgentTurnState(set, sessionId, agentId, { kind: 'starting', startedAt }, startedAt);
  const deadline = Date.now() + OVERLAP_WAIT_LIMIT_MS;
  const leave = (): void => {
    clusterLaunching.release({ childId: agentId });
    putWait({ set, agentId, sessionId, blocker: null });
    applyAgentTurnState(set, sessionId, agentId, previous, nowIso({}));
  };
  try {
    while (blockers.length > 0) {
      putWait({ set, agentId, sessionId, blocker: blockers[0]! });
      await writerWaiters.wait({ ms: OVERLAP_POLL_MS });
      if (isTurnStartCancelled({ agentId })) {
        claimTurnStart({ agentId });
        leave();
        return 'cancelled';
      }
      if (Date.now() >= deadline) {
        leave();
        return 'timed_out';
      }
      blockers = blockersOf({ get, sessionId, child });
    }
  } catch (error) {
    leave();
    throw error;
  }
  putWait({ set, agentId, sessionId, blocker: null });
  applyAgentTurnState(set, sessionId, agentId, previous, nowIso({}));
  return 'proceed';
};

const putWait = ({ set, agentId, sessionId, blocker }: WaitParams): void => {
  set((state) => {
    const rest = Object.fromEntries(
      Object.entries(state.agentWriterWait).filter(([id]) => id !== agentId),
    );
    if (blocker === null) {
      return { agentWriterWait: rest };
    }
    return {
      agentWriterWait: {
        ...rest,
        [agentId]: {
          sessionId,
          blockedPath: '',
          blockedBy: blocker.id,
          blockedPart: blocker.name,
          since: state.agentWriterWait[agentId]?.since ?? nowIso({}),
        },
      },
    };
  });
};
