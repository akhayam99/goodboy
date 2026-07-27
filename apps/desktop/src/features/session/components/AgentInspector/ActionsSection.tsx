import { CircleCheck, CircleDot, OctagonX, Trash2 } from 'lucide-react';
import type { Agent, SessionId } from '@goodboy/types';
import { ConfirmableButton } from '../../../../shared/components/ConfirmableButton';
import { useAppStore } from '../../../../store';
import { InspectorSection } from '../InspectorSection';

type Props = {
  readonly agent: Agent;
  readonly sessionId: SessionId;
  readonly onDeleted?: () => void;
};

const ACTION_CLASS =
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground';

export const ActionsSection = ({ agent, sessionId, onDeleted }: Props) => {
  const setAgentDone = useAppStore((state) => state.setAgentDone);
  const clearAgentDone = useAppStore((state) => state.clearAgentDone);
  const cancelCurrentTurn = useAppStore((state) => state.cancelCurrentTurn);
  const deleteAgent = useAppStore((state) => state.deleteAgent);
  const isTurnRunning = useAppStore((state) => state.agentTurnState[agent.id]?.kind === 'running');

  const remove = async () => {
    await deleteAgent(sessionId, agent.id);
    onDeleted?.();
  };

  return (
    <InspectorSection question="What you can do">
      <div className="flex flex-wrap items-center gap-1.5">
        {agent.doneAt == null ? (
          <button
            type="button"
            onClick={() => void setAgentDone(sessionId, agent.id)}
            className={ACTION_CLASS}
          >
            <CircleCheck size={10} aria-hidden />
            Mark done
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void clearAgentDone(sessionId, agent.id)}
            className={ACTION_CLASS}
          >
            <CircleDot size={10} aria-hidden />
            Reopen
          </button>
        )}
        {isTurnRunning ? (
          <button
            type="button"
            onClick={() => void cancelCurrentTurn(sessionId, agent.id)}
            className={ACTION_CLASS}
          >
            <OctagonX size={10} aria-hidden />
            Interrupt
          </button>
        ) : null}
        <ConfirmableButton
          label="Delete"
          armedLabel="Confirm delete"
          busyLabel="Deleting..."
          onConfirm={remove}
          tone="danger"
          icon={<Trash2 size={10} aria-hidden />}
        />
      </div>
    </InspectorSection>
  );
};
