import { Button, FormActions, Tooltip } from '@goodboy/ui';
import type { AnswerInputMode } from './answerInputMode';
import { KeyHint } from './KeyHint';

type Props = {
  readonly inputMode: AnswerInputMode;
  readonly optionCount: number;
  readonly canAnswer: boolean;
  readonly isHandOff: boolean;
  readonly onAnswer: () => void;
  readonly onSkip: (() => void) | null;
  readonly onSendAsMessage?: (() => void) | null;
};

const SEND_AS_MESSAGE_HINT =
  'Not an answer? Sends your text to the agent as a normal message and closes this question.';

export const AnswerSubmitButton = ({
  inputMode,
  optionCount,
  canAnswer,
  isHandOff,
  onAnswer,
  onSkip,
  onSendAsMessage = null,
}: Props) => (
  <FormActions
    leading={
      <span className="flex min-w-0 items-center gap-2 whitespace-nowrap text-label text-faint-foreground @max-[34rem]:hidden">
        <KeyHint inputMode={inputMode} optionCount={optionCount} />
      </span>
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
      className="min-w-18"
    >
      {isHandOff ? 'Hand off' : 'Answer'}
    </Button>
  </FormActions>
);
