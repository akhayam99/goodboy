import { useState } from 'react';
import { CircleCheck, CircleDot, OctagonX, Trash2 } from 'lucide-react';
import { InlineConfirm, SectionHeader } from '@goodboy/ui';
import type { Agent, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { GhostActionButton } from '../../../../shared/components/GhostActionButton';

type Props = {
  readonly agent: Agent;
  readonly sessionId: SessionId;
  readonly onDeleted?: () => void;
};

export const ActionsSection = ({ agent, sessionId, onDeleted }: Props) => {
  const setAgentDone = useAppStore((state) => state.setAgentDone);
  const clearAgentDone = useAppStore((state) => state.clearAgentDone);
  const cancelCurrentTurn = useAppStore((state) => state.cancelCurrentTurn);
  const deleteAgent = useAppStore((state) => state.deleteAgent);
  const isTurnRunning = useAppStore((state) => state.agentTurnState[agent.id]?.kind === 'running');
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const remove = async () => {
    await deleteAgent(sessionId, agent.id);
    setIsConfirmingDelete(false);
    onDeleted?.();
  };

  return (
    <section className="flex flex-col gap-2">
      <SectionHeader label="Actions" />
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {agent.doneAt == null ? (
            <GhostActionButton
              icon={CircleCheck}
              label="Mark done"
              onClick={() => void setAgentDone(sessionId, agent.id)}
            />
          ) : (
            <GhostActionButton
              icon={CircleDot}
              label="Reopen"
              onClick={() => void clearAgentDone(sessionId, agent.id)}
            />
          )}
          {isTurnRunning ? (
            <GhostActionButton
              icon={OctagonX}
              label="Interrupt"
              onClick={() => void cancelCurrentTurn(sessionId, agent.id)}
            />
          ) : null}
          <GhostActionButton
            icon={Trash2}
            label="Delete"
            tone="danger"
            onClick={() => setIsConfirmingDelete(true)}
          />
        </div>
        {isConfirmingDelete && (
          <InlineConfirm
            role="danger"
            icon={<Trash2 size={12} aria-hidden />}
            title="Delete agent?"
            description="Removes this agent and its transcript from the session."
            confirmLabel="Delete"
            onConfirm={remove}
            onCancel={() => setIsConfirmingDelete(false)}
          />
        )}
      </div>
    </section>
  );
};
