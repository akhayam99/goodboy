import { useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { IconButton, Input } from '@goodboy/ui';
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

const timingCopy = ({ isDeciding, isStepRunning }: TimingParams): string | null => {
  if (isDeciding) {
    return 'Sending restarts the decision in flight with your hint';
  }
  if (isStepRunning) {
    return 'The orchestrator reads it when the step in flight finishes';
  }
  return null;
};

export const OrchestratorHintComposer = ({
  isDeciding,
  isStepRunning,
  disabled,
  onSubmit,
}: Props) => {
  const [text, setText] = useState('');
  const canSend = disabled === false && text.trim() !== '';
  const timing = timingCopy({ isDeciding, isStepRunning });

  const send = async () => {
    if (canSend === false) {
      return;
    }
    await onSubmit({ text });
    setText('');
  };

  return (
    <form
      aria-label="Tell the orchestrator"
      className="flex flex-col gap-1"
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
      {timing == null ? null : (
        <span data-testid="orchestrator-hint-timing" className="text-2xs text-muted-foreground">
          {timing}
        </span>
      )}
    </form>
  );
};
