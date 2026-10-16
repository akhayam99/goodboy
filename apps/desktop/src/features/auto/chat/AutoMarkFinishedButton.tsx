import type { AgentId, SessionId } from '@goodboy/types';
import { Button } from '@goodboy/ui';
import { useAppStore } from '../../../store';
import { useActionControls } from '../../actions/useActionControls';
import { isTurnStateLive } from '../../session/agent-lifecycle';

type Props = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

const MARK_FINISHED = 'agent.markAutoFinished';

export const AutoMarkFinishedButton = ({ sessionId, agentId }: Props) => {
  const controls = useActionControls({
    target: { kind: 'agent', sessionId, agentId },
    anchorKey: `auto-mark-finished:${agentId}`,
    scopeKey: agentId,
  });
  const isTurnLive = useAppStore((state) =>
    isTurnStateLive({ turnState: state.agentTurnState[agentId] }),
  );
  const action = controls.actions.find((candidate) => candidate.id === MARK_FINISHED);
  if (action === undefined || isTurnLive) {
    return null;
  }
  const isPending = controls.pendingId === MARK_FINISHED;
  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={action.blockedReason !== null || isPending}
      isBusy={isPending}
      busyLabel="Marking finished"
      title={action.blockedReason ?? undefined}
      onClick={() => controls.trigger({ actionId: MARK_FINISHED })}
    >
      {action.label}
    </Button>
  );
};
