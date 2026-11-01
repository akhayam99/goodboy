import type { ReactNode } from 'react';
import { Button, FormActions, Tooltip } from '@goodboy/ui';
import type { AnswerInputMode } from './answerInputMode';
import { KeyHint } from './KeyHint';

type Props = {
  readonly inputMode: AnswerInputMode;
  readonly optionCount: number;
  readonly canAnswer: boolean;
  readonly isHandOff: boolean;
  readonly isReadOnly?: boolean;
  readonly onAnswer: () => void;
  readonly onSkip: (() => void) | null;
  readonly onSendAsMessage?: (() => void) | null;
  readonly lead?: ReactNode;
};

const SEND_AS_MESSAGE_HINT =
  'Not an answer? Sends your text to the agent as a normal message and closes this question.';

export const AnswerSubmitButton = ({
  inputMode,
  optionCount,
  canAnswer,
  isHandOff,
  isReadOnly = false,
  onAnswer,
  onSkip,
  onSendAsMessage = null,
  lead,
}: Props) => (
  <FormActions
    leading={
      isReadOnly && lead === undefined ? null : lead === undefined ? (
        <span className="flex min-w-0 items-center gap-2 whitespace-nowrap text-meta text-faint-foreground @max-[34rem]:hidden">
          <KeyHint inputMode={inputMode} optionCount={optionCount} />
        </span>
      ) : (
        lead
      )
    }
  >
    {onSkip !== null && (
      <Button variant="ghost" size="sm" onClick={onSkip} className="text-muted-foreground">
        Skip
      </Button>
    )}
    {onSendAsMessage !== null && !isHandOff && (
      <Tooltip content={SEND_AS_MESSAGE_HINT}>
        <Button
          variant="ghost"
          size="sm"
          disabled={!canAnswer}
          onClick={onSendAsMessage}
          className="text-muted-foreground"
        >
          Send as message
        </Button>
      </Tooltip>
    )}
    <Button
      variant="primary"
      size="sm"
      disabled={!canAnswer}
      onClick={onAnswer}
      data-demo-anchor="question-answer"
      className="min-w-18"
    >
      {isHandOff ? 'Hand off' : 'Answer'}
    </Button>
  </FormActions>
);
