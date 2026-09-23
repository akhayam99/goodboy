import { useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { Checkbox, IconButton, Input } from '@goodboy/ui';
import type { OrchestratorHintDraft } from '../../../../store/slices/workflows/addWorkflowOrchestratorHint';

type Props = {
  readonly isDeciding: boolean;
  readonly isStepRunning: boolean;
  readonly disabled: boolean;
  readonly onSubmit: (draft: OrchestratorHintDraft) => Promise<void>;
};

type TimingParams = {
  readonly isDeciding: boolean;
  readonly isStepRunning: boolean;
};

const timingCopy = ({ isDeciding, isStepRunning }: TimingParams): string => {
  if (isDeciding) {
    return 'Sending restarts the decision in flight with your hint';
  }
  if (isStepRunning) {
    return 'Read when the step in flight finishes';
  }
  return 'Read at the next decision';
};

export const OrchestratorHintComposer = ({
  isDeciding,
  isStepRunning,
  disabled,
  onSubmit,
}: Props) => {
  const [text, setText] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const canSend = disabled === false && text.trim() !== '';

  const send = async () => {
    if (canSend === false) {
      return;
    }
    await onSubmit({ text, isPinned });
    setText('');
    setIsPinned(false);
  };

  return (
    <form
      aria-label="Tell the orchestrator"
      className="flex flex-col gap-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      <div className="flex items-center gap-1.5">
        <Input
          id="orchestrator-hint-field"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Tell the orchestrator something"
          aria-label="Hint for the orchestrator"
          data-testid="orchestrator-hint-input"
          disabled={disabled}
          className="h-7 text-2xs"
        />
        <IconButton
          icon={ArrowUp}
          label="Send hint"
          type="submit"
          disabled={canSend === false}
          data-testid="orchestrator-hint-send"
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Checkbox
          id="orchestrator-hint-pinned"
          checked={isPinned}
          disabled={disabled}
          onChange={setIsPinned}
          label={<span className="text-2xs text-muted-foreground">Keep for every step</span>}
        />
        <span data-testid="orchestrator-hint-timing" className="text-2xs text-muted-foreground">
          {timingCopy({ isDeciding, isStepRunning })}
        </span>
      </div>
    </form>
  );
};
