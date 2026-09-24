import { useState } from 'react';
import { formatError } from '@goodboy/ui';
import { CircleCheck, CircleDot, OctagonX, Trash2 } from 'lucide-react';
import { InlineConfirm } from '@goodboy/ui';
import type { Agent, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { isAgentClosable, isAgentClosedByUser, isTurnStateLive } from '../agent-lifecycle';
import { GhostActionButton } from '@goodboy/ui';
import { ICON_SIZE } from '../../../shared/components/conceptIcons';

type Props = {
  readonly agent: Agent;
  readonly sessionId: SessionId;
  readonly allowInterrupt?: boolean;
  readonly deleteTitle?: string;
  readonly deleteDescription?: string;
  readonly onDeleted?: () => void;
};

export const AgentHeaderActions = ({
  agent,
  sessionId,
  allowInterrupt = false,
  deleteTitle = 'Delete agent?',
  deleteDescription = 'Removes this agent and its transcript from the session.',
  onDeleted,
}: Props) => {
  const setAgentDone = useAppStore((state) => state.setAgentDone);
  const clearAgentDone = useAppStore((state) => state.clearAgentDone);
  const cancelCurrentTurn = useAppStore((state) => state.cancelCurrentTurn);
  const deleteAgent = useAppStore((state) => state.deleteAgent);
  const isTurnRunning = useAppStore((state) => state.agentTurnState[agent.id]?.kind === 'running');
  const isTurnLive = useAppStore((state) =>
    isTurnStateLive({ turnState: state.agentTurnState[agent.id] }),
  );
  const hasOpenQuestion = useAppStore((state) =>
    (state.sessionOpenQuestions[sessionId] ?? []).some(
      (question) => question.status === 'open' && question.createdByAgentId === agent.id,
    ),
  );
  const isClosable = isAgentClosable({ agent, hasOpenQuestion, isTurnLive });
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const armDelete = () => {
    setDeleteError(null);
    setIsConfirmingDelete(true);
  };

  const remove = async () => {
    try {
      await deleteAgent(sessionId, agent.id);
    } catch (error) {
      setDeleteError(`Couldn't delete this agent. ${formatError(error)}`);
      return;
    }
    setIsConfirmingDelete(false);
    onDeleted?.();
  };

  return (
    <div className="flex shrink-0 flex-col items-end gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {isClosable && (
          <GhostActionButton
            icon={CircleCheck}
            label="Close"
            title="Stop waiting on this agent"
            onClick={() => void setAgentDone(sessionId, agent.id)}
          />
        )}
        {isAgentClosedByUser({ agent }) && (
          <GhostActionButton
            icon={CircleDot}
            label="Reopen"
            onClick={() => void clearAgentDone(sessionId, agent.id)}
          />
        )}
        {allowInterrupt && isTurnRunning ? (
          <GhostActionButton
            icon={OctagonX}
            label="Interrupt"
            onClick={() => void cancelCurrentTurn(sessionId, agent.id)}
          />
        ) : null}
        <GhostActionButton icon={Trash2} label="Delete" tone="danger" onClick={armDelete} />
      </div>
      {isConfirmingDelete && (
        <InlineConfirm
          role="danger"
          icon={<Trash2 size={ICON_SIZE.row} aria-hidden />}
          title={deleteTitle}
          description={deleteDescription}
          confirmLabel="Delete"
          note={
            deleteError !== null ? (
              <p role="alert" className="text-2xs text-danger">
                {deleteError}
              </p>
            ) : null
          }
          onConfirm={remove}
          onCancel={() => setIsConfirmingDelete(false)}
        />
      )}
    </div>
  );
};
