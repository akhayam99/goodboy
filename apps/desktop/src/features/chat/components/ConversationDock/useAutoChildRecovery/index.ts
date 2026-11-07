import type { AgentId, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import { usePendingAction } from '../../../../../shared/hooks/usePendingAction';
import { autoTreeOfAgent } from '../../../../auto/autoTreeOfAgent';
import { delegationReasonTextOf } from '../../../../auto/delegationReasonTextOf';
import type { DockFailure } from '../dockFailureOf';

type Params = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId | null;
  readonly failure: DockFailure | null;
};

export const useAutoChildRecovery = ({
  sessionId,
  agentId,
  failure,
}: Params): DockFailure | null => {
  const views = useAppStore((state) => state.autoTreeViews[sessionId] ?? EMPTY_ARRAY);
  const agent = useAppStore((state) =>
    state.sessionPhaseRuns[sessionId]?.find((candidate) => candidate.id === agentId),
  );
  const turn = useAppStore((state) =>
    agentId === null ? null : (state.agentTurnState[agentId] ?? null),
  );
  const tree = agentId === null ? null : autoTreeOfAgent({ views, agentId });
  const rootTurn = useAppStore((state) =>
    tree === null ? null : (state.agentTurnState[tree.view.tree.rootAgentId] ?? null),
  );
  const continueStoppedAgent = useAppStore((state) => state.continueStoppedAgent);
  const pending = usePendingAction({ sessionId });
  if (
    tree?.kind !== 'child' ||
    agentId === null ||
    agent?.status === 'stopped' ||
    turn?.kind === 'running' ||
    turn?.kind === 'starting'
  ) {
    return failure;
  }
  const delegation = tree.delegation;
  if (
    delegation.state !== 'settled' ||
    (delegation.outcome !== 'failed' &&
      delegation.outcome !== 'blocked' &&
      delegation.outcome !== 'timed_out')
  ) {
    return failure;
  }
  const isRootLive = rootTurn?.kind === 'running' || rootTurn?.kind === 'starting';
  return {
    message:
      failure?.message ??
      delegationReasonTextOf({ reason: delegation.reason }) ??
      'The agent ended with an error.',
    runId: failure?.runId ?? null,
    isRetrying: pending.pendingKeys.has(agentId),
    retry: isRootLive
      ? null
      : () =>
          void pending.run({
            key: agentId,
            failureTitle: "Couldn't retry the agent",
            task: () => continueStoppedAgent({ sessionId, agentId }),
          }),
  };
};
