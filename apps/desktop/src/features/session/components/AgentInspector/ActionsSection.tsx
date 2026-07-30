import { useState } from 'react';
import { CircleCheck, CircleDot, OctagonX, Trash2 } from 'lucide-react';
import { InlineConfirm, cn } from '@goodboy/ui';
import type { Agent, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { INSPECTOR_ACTION_CLASS, InspectorSection } from '../InspectorSection';

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
    <InspectorSection question="What you can do">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {agent.doneAt == null ? (
            <button
              type="button"
              onClick={() => void setAgentDone(sessionId, agent.id)}
              className={INSPECTOR_ACTION_CLASS}
            >
              <CircleCheck size={10} aria-hidden />
              Mark done
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void clearAgentDone(sessionId, agent.id)}
              className={INSPECTOR_ACTION_CLASS}
            >
              <CircleDot size={10} aria-hidden />
              Reopen
            </button>
          )}
          {isTurnRunning ? (
            <button
              type="button"
              onClick={() => void cancelCurrentTurn(sessionId, agent.id)}
              className={INSPECTOR_ACTION_CLASS}
            >
              <OctagonX size={10} aria-hidden />
              Interrupt
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setIsConfirmingDelete(true)}
            className={cn(INSPECTOR_ACTION_CLASS, 'text-danger hover:text-danger')}
          >
            <Trash2 size={10} aria-hidden />
            Delete
          </button>
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
    </InspectorSection>
  );
};
