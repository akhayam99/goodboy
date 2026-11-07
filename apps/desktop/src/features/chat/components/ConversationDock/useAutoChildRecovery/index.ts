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
  const continueStoppedAgent = useAppStore((state) => state.continueStoppedAgent);
  const pending = usePendingAction({ sessionId });
  const tree = agentId === null ? null : autoTreeOfAgent({ views, agentId });
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
  if (delegation.state !== 'settled' || (delegation.outcome !== 'failed' && failure === null)) {
    return failure;
  }
  return {
    message:
      failure?.message ??
      delegationReasonTextOf({ reason: delegation.reason }) ??
      'The agent ended with an error.',
    runId: null,
    isRetrying: pending.pendingKeys.has(agentId),
    retry: () =>
      void pending.run({
        key: agentId,
        failureTitle: "Couldn't retry the agent",
        task: () => continueStoppedAgent({ sessionId, agentId }),
      }),
  };
};
