import { useRef, useState } from 'react';
import { Button, FormActions, formatError } from '@goodboy/ui';
import type { Agent, SessionId } from '@goodboy/types';
import { agentPlace, useAppStore } from '../../../store';
import { PromptField } from '../../../shared/components/PromptField';
import { useShowToast } from '../../../shared/components/Toast/useShowToast';
import { detachFromAuto } from '../detachFromAuto';
import { moveToAuto } from '../moveToAuto';
import { useIsAutoReleased } from '../useIsAutoReleased';
import { NAMES } from '../../../shared/utils/names';

type Props = {
  readonly sessionId: SessionId;
  readonly agent: Agent;
  readonly onClose: () => void;
};

const PLACEHOLDER = 'Optional. Leave it empty and Auto decides from the transcript.';
const UNDO_CONFLICT = 'Auto is working with it now. Use Detach from Auto when its turn ends.';

export const MoveToAutoPanel = ({ sessionId, agent, onClose }: Props) => {
  const [instruction, setInstruction] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const isMovingRef = useRef(false);
  const navigate = useAppStore((state) => state.navigate);
  const undoable = useAppStore((state) => state.undoable);
  const showToast = useShowToast();
  const isReleased = useIsAutoReleased();

  const submit = async (): Promise<void> => {
    if (isMovingRef.current) {
      return;
    }
    isMovingRef.current = true;
    setIsMoving(true);
    setError(null);
    try {
      const outcome = await moveToAuto({ sessionId, agentId: agent.id, instruction, isReleased });
      if (outcome.kind === 'adopted' || outcome.kind === 'exists') {
        navigate({ to: agentPlace({ sessionId, agentId: outcome.autoAgentId }) });
        if (outcome.kind === 'adopted') {
          undoable({
            showToast,
            title: `Auto took ${agent.name} from here`,
            message: 'Auto reads its work and decides what comes next.',
            conflictMessage: UNDO_CONFLICT,
            undo: async () =>
              (
                await detachFromAuto({
                  getState: useAppStore.getState,
                  sessionId,
                  agentId: agent.id,
                })
              ).kind === 'detached',
          });
        }
        onClose();
        return;
      }
      setError(outcome.message);
    } catch (cause) {
      setError(formatError(cause));
    } finally {
      isMovingRef.current = false;
      setIsMoving(false);
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-col gap-1">
        <span className="text-row text-foreground">What should Auto do next?</span>
        <p className="text-meta text-muted-foreground">
          {agent.name} keeps its chat and its files. Auto takes over from here and hands new work to
          new agents.
        </p>
      </div>
      <PromptField
        kind="document"
        label="What should Auto do next?"
        value={instruction}
        onChange={setInstruction}
        disabled={isMoving}
        placeholder={PLACEHOLDER}
        minRows={2}
        maxRows={6}
        textClassName="text-meta"
      />
      <FormActions error={error}>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          disabled={isMoving}
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          isBusy={isMoving}
          disabled={isMoving}
          onClick={() => void submit()}
        >
          {NAMES.letAutoTakeIt}
        </Button>
      </FormActions>
    </div>
  );
};
