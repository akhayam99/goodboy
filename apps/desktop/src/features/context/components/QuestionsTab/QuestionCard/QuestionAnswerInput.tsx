import { Textarea, cn } from '@goodboy/ui';
import type { OpenQuestionSelectMode } from '@goodboy/types';
import { AnswerOptionRow } from '../AnswerOptionRow';
import type { AnswerInputMode } from '../AnswerSubmitButton/answerInputMode';
import { CustomAnswerField } from '../CustomAnswerField';

type Props = {
  readonly inputMode: AnswerInputMode;
  readonly suggestions: ReadonlyArray<string>;
  readonly recommended: string;
  readonly selectedSuggestions: ReadonlyArray<string>;
  readonly customAnswer: string;
  readonly showCustomField: boolean;
  readonly askerName: string | null;
  readonly isSettled: boolean;
  readonly isHandedOff: boolean;
  readonly isCompact: boolean;
  readonly onToggleSuggestion: (suggestion: string) => void;
  readonly onToggleCustomField: () => void;
  readonly onSetCustomAnswer: (text: string) => void;
  readonly onSubmit: () => void;
  readonly onEscape: () => void;
};

const selectModeOf = (inputMode: AnswerInputMode): OpenQuestionSelectMode =>
  inputMode === 'many' ? 'many' : 'one';

export const QuestionAnswerInput = ({
  inputMode,
  suggestions,
  recommended,
  selectedSuggestions,
  customAnswer,
  showCustomField,
  askerName,
  isSettled,
  isHandedOff,
  isCompact,
  onToggleSuggestion,
  onToggleCustomField,
  onSetCustomAnswer,
  onSubmit,
  onEscape,
}: Props) => {
  const isInert = isSettled || isHandedOff;
  const placeholder = `Tell ${askerName ?? 'the agent'} what you want instead`;

  if (inputMode === 'text') {
    if (isSettled) {
      return (
        <p className="rounded-md bg-fill px-3 py-2 text-body text-foreground">{customAnswer}</p>
      );
    }
    return (
      <Textarea
        aria-label="Your answer"
        value={customAnswer}
        disabled={isHandedOff}
        onChange={(event) => onSetCustomAnswer(event.target.value)}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            onSubmit();
            return;
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            onEscape();
          }
        }}
        placeholder={`Type your answer for ${askerName ?? 'the agent'}`}
        autoGrow
        minRows={isCompact ? 2 : 3}
        maxRows={8}
        className={cn('w-full resize-none bg-fill text-body', isHandedOff && 'opacity-50')}
      />
    );
  }

  const mode = selectModeOf(inputMode);
  const isCustomOn = showCustomField;

  return (
    <div
      role={mode === 'many' ? 'group' : 'radiogroup'}
      aria-label={mode === 'many' ? 'Pick one or more answers' : 'Pick one answer'}
      className={cn('flex flex-col', isCompact ? 'gap-1.5' : 'gap-2')}
    >
      {suggestions.map((suggestion, index) => {
        const isSelected = !isHandedOff && selectedSuggestions.includes(suggestion);
        return (
          <AnswerOptionRow
            key={suggestion}
            label={suggestion}
            keyHint={index + 1}
            mode={mode}
            selected={isSelected}
            recommended={recommended.length > 0 && suggestion === recommended}
            dimmed={isHandedOff || (isSettled && !isSelected)}
            disabled={isInert}
            onToggle={() => onToggleSuggestion(suggestion)}
          />
        );
      })}
      {(!isSettled || isCustomOn) && (
        <CustomAnswerField
          value={customAnswer}
          open={!isHandedOff && isCustomOn}
          mode={mode}
          disabled={isInert}
          dimmed={isHandedOff}
          placeholder={placeholder}
          onToggle={onToggleCustomField}
          onChange={onSetCustomAnswer}
          onSubmit={onSubmit}
          onEscape={onEscape}
        />
      )}
    </div>
  );
};
