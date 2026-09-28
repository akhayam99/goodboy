import { Button, FormActions } from '@goodboy/ui';
import type { AnswerInputMode } from './answerInputMode';
import { KeyHint } from './KeyHint';

type Props = {
  readonly inputMode: AnswerInputMode;
  readonly optionCount: number;
  readonly canAnswer: boolean;
  readonly isHandOff: boolean;
  readonly onAnswer: () => void;
  readonly onSkip: (() => void) | null;
};

export const AnswerSubmitButton = ({
  inputMode,
  optionCount,
  canAnswer,
  isHandOff,
  onAnswer,
  onSkip,
}: Props) => (
  <FormActions
    leading={
      <span className="flex min-w-0 items-center gap-1.5 whitespace-nowrap text-label text-faint-foreground @max-[34rem]:hidden">
        <KeyHint inputMode={inputMode} optionCount={optionCount} />
      </span>
    }
  >
    {onSkip !== null && (
      <Button variant="ghost" size="sm" onClick={onSkip} className="text-muted-foreground">
        Skip
      </Button>
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
