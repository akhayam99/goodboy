import { useEffect, useState } from 'react';
import { Check, MessageCircleQuestion, X } from 'lucide-react';
import { cn, Markdown, tintClasses } from '@goodboy/ui';
import type { OpenQuestion, OpenQuestionId, OpenQuestionSelectMode } from '@goodboy/types';
import { formatRelativeAge } from '../../../../../shared/utils/relativeDate';
import { CONCEPT_TONE } from '../../../../../shared/components/conceptIcons';
import { TranscriptShell } from '../../../../chat/components/TranscriptShell';
import { SuggestionRow } from '../SuggestionRow';
import { CustomAnswerField } from '../CustomAnswerField';
import { deriveSuggestions } from '../deriveSuggestions';
import { orderSuggestions } from '../orderSuggestions';

const warningTint = tintClasses(CONCEPT_TONE.questions);

type Props = {
  question: OpenQuestion;
  selectedSuggestions: ReadonlyArray<string>;
  customAnswer: string;
  showCustomField: boolean;
  justAnswered: boolean;
  onToggleSuggestion: (
    questionId: OpenQuestionId,
    suggestion: string,
    mode: OpenQuestionSelectMode,
  ) => void;
  onSetCustomAnswer: (questionId: OpenQuestionId, text: string) => void;
  onToggleCustomField: (questionId: OpenQuestionId) => void;
  onDismiss: (id: OpenQuestionId) => void;
  onClearJustAnswered: (id: OpenQuestionId) => void;
};

export const QuestionCard = ({
  question,
  selectedSuggestions,
  customAnswer,
  showCustomField,
  justAnswered,
  onToggleSuggestion,
  onSetCustomAnswer,
  onToggleCustomField,
  onDismiss,
  onClearJustAnswered,
}: Props) => {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (!justAnswered) {
      return;
    }
    setAnimate(true);
    const t = setTimeout(() => {
      setAnimate(false);
      onClearJustAnswered(question.id);
    }, 800);
    return () => clearTimeout(t);
  }, [justAnswered, question.id, onClearJustAnswered]);

  const baseSuggestions =
    question.suggestedAnswers.length > 0
      ? question.suggestedAnswers
      : deriveSuggestions(question.text);

  const recommended = question.recommendedAnswer?.trim() ?? '';
  const suggestions = orderSuggestions({
    suggestions: baseSuggestions,
    recommendedAnswer: recommended,
  });

  const mode: OpenQuestionSelectMode = question.selectMode ?? 'one';
  const groupRole = mode === 'many' ? 'group' : 'radiogroup';
  const groupLabel = mode === 'many' ? 'Pick one or more answers' : 'Pick one answer';

  return (
    <TranscriptShell
      tone={CONCEPT_TONE.questions}
      variant="leftBorder"
      className="group flex flex-col gap-1.5 transition-[background-color,transform] duration-200 motion-safe:animate-fade-in"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
        <div className="flex min-w-0 items-start gap-2">
          <MessageCircleQuestion
            size={14}
            aria-hidden
            className={cn('shrink-0 translate-y-0.5', warningTint.icon)}
          />
          <Markdown
            text={question.text}
            className="min-w-0 gap-1.5 break-words text-sm font-medium leading-relaxed text-foreground"
          />
        </div>
        <button
          type="button"
          onClick={() => onDismiss(question.id)}
          className={cn(
            'shrink-0 rounded-md p-1 text-muted-foreground/60 opacity-0 transition-[opacity,color,background-color] duration-150',
            'hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40',
            'group-hover:opacity-100 motion-reduce:opacity-60',
            animate && 'opacity-100',
          )}
          title="Dismiss question"
          aria-label="Dismiss question"
        >
          {animate ? <Check size={12} className={warningTint.icon} /> : <X size={12} />}
        </button>
        <div className="flex items-center gap-2 text-2xs text-muted-foreground">
          <span>{formatRelativeAge({ fromIso: question.createdAt })}</span>
          {question.ownedByStepOrdinal != null && (
            <span className="rounded-md bg-muted px-1 py-0.5 font-mono text-2xs text-muted-foreground">
              step {question.ownedByStepOrdinal}
            </span>
          )}
          {question.workflowId && question.ownedByStepOrdinal != null && (
            <span className="rounded-md bg-muted px-1 py-0.5 text-2xs text-muted-foreground">
              workflow
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1 pl-6">
        <div role={groupRole} aria-label={groupLabel} className="flex flex-col gap-1">
          {suggestions.map((suggestion) => (
            <SuggestionRow
              key={suggestion}
              label={suggestion}
              mode={mode}
              selected={selectedSuggestions.includes(suggestion)}
              recommended={recommended.length > 0 && suggestion === recommended}
              onToggle={() => onToggleSuggestion(question.id, suggestion, mode)}
            />
          ))}
        </div>
        <CustomAnswerField
          value={customAnswer}
          open={showCustomField}
          onToggle={() => onToggleCustomField(question.id)}
          onChange={(text) => onSetCustomAnswer(question.id, text)}
        />
      </div>
    </TranscriptShell>
  );
};
