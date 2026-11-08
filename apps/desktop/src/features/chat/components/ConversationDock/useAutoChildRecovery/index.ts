import type { AgentId, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import { usePendingAction } from '../../../../../shared/hooks/usePendingAction';
import { autoSettledStateOf } from '../../../../auto/autoSettledStateOf';
import { autoTreeOfAgent } from '../../../../auto/autoTreeOfAgent';
import { isAutoDelegationReplaced } from '../../../../auto/isAutoDelegationReplaced';
import { delegationReasonTextOf } from '../../../../auto/delegationReasonTextOf';
import type { DockFailure } from '../dockFailureOf';
import { isRepliedAfter } from './isRepliedAfter';

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
  const settledAt = tree?.kind === 'child' ? tree.delegation.settledAt : null;
  const hasNewerReply = useAppStore((state) =>
    agentId === null || settledAt === null
      ? false
      : isRepliedAfter({ events: state.transcripts[agentId] ?? EMPTY_ARRAY, since: settledAt }),
  );
  const continueStoppedAgent = useAppStore((state) => state.continueStoppedAgent);
  const pending = usePendingAction({ sessionId });
  if (
    tree?.kind !== 'child' ||
    agentId === null ||
    agent?.status === 'stopped' ||
    turn?.kind === 'running' ||
    turn?.kind === 'starting' ||
    hasNewerReply
  ) {
    return failure;
  }
  const delegation = tree.delegation;
  if (delegation.state !== 'settled' || delegation.outcome === null) {
    return failure;
  }
  const word = autoSettledStateOf({
    outcome: delegation.outcome,
    isReplaced: isAutoDelegationReplaced({ delegation, delegations: tree.view.delegations }),
  });
  if (word !== 'failed' && word !== 'timedOut') {
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
