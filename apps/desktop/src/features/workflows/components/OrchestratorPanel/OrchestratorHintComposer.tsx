import { useRef, useState } from 'react';
import { Button, Input } from '@goodboy/ui';
import type {
  OrchestratorHintDelivery,
  OrchestratorHintDraft,
} from '../../../../store/slices/workflows/addWorkflowOrchestratorHint';

type Props = {
  readonly isDeciding: boolean;
  readonly isStepRunning: boolean;
  readonly onSubmit: (draft: OrchestratorHintDraft) => Promise<boolean>;
};

type SendParams = {
  readonly delivery: OrchestratorHintDelivery;
};

type ReadNowParams = {
  readonly isDeciding: boolean;
  readonly isStepRunning: boolean;
};

const readNowCopy = ({ isDeciding, isStepRunning }: ReadNowParams): string => {
  if (isDeciding) {
    return 'Read now restarts this one with your hint.';
  }
  if (isStepRunning) {
    return 'Read now stops the step in flight, keeps what it wrote, and decides again.';
  }
  return 'Read now asks for a decision right away.';
};

export const OrchestratorHintComposer = ({ isDeciding, isStepRunning, onSubmit }: Props) => {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const canSend = text.trim() !== '';

  const send = async ({ delivery }: SendParams) => {
    const draft = text;
    if (draft.trim() === '') {
      return;
    }
    setText('');
    inputRef.current?.focus();
    const isSaved = await onSubmit({ text: draft, delivery });
    if (isSaved) {
      return;
    }
    setText((current) => (current === '' ? draft : current));
  };

  return (
    <form
      aria-label="Tell the orchestrator"
      className="flex flex-col gap-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        void send({ delivery: 'queue' });
      }}
    >
      <Input
        ref={inputRef}
        id="orchestrator-hint-field"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Tell the orchestrator something"
        aria-label="Hint for the orchestrator"
        data-testid="orchestrator-hint-input"
        className="h-7 text-2xs"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span data-testid="orchestrator-hint-timing" className="text-2xs text-muted-foreground">
          Queue waits for the next decision. {readNowCopy({ isDeciding, isStepRunning })}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <Button
            type="submit"
            size="sm"
            variant="ghost"
            disabled={canSend === false}
            data-testid="orchestrator-hint-queue"
          >
            Queue
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={canSend === false}
            data-testid="orchestrator-hint-now"
            onClick={() => void send({ delivery: 'now' })}
          >
            Read now
          </Button>
        </span>
      </div>
    </form>
  );
};
