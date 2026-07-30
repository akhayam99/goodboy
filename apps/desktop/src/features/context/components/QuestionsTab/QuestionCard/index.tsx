import { useEffect, useState } from 'react';
import { Check, MessageCircleQuestion, X } from 'lucide-react';
import { cn, Markdown } from '@goodboy/ui';
import type { OpenQuestion, OpenQuestionId } from '@goodboy/types';
import { SuggestionChip } from '../SuggestionChip';
import { CustomAnswerField } from '../CustomAnswerField';
import { deriveSuggestions } from '../deriveSuggestions';

type Props = {
  question: OpenQuestion;
  selectedSuggestions: ReadonlyArray<string>;
  customAnswer: string;
  showCustomField: boolean;
  justAnswered: boolean;
  onToggleSuggestion: (questionId: OpenQuestionId, suggestion: string) => void;
  onSetCustomAnswer: (questionId: OpenQuestionId, text: string) => void;
  onToggleCustomField: (questionId: OpenQuestionId) => void;
  onDismiss: (id: OpenQuestionId) => void;
  onClearJustAnswered: (id: OpenQuestionId) => void;
};

function relativeAge(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) {
    return 'just now';
  }
  if (mins < 60) {
    return `${mins}m ago`;
  }
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) {
    return `${hrs}h ago`;
  }
  return `${Math.floor(hrs / 24)}d ago`;
}

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

  const hasPendingAnswer = selectedSuggestions.length > 0 || customAnswer.trim().length > 0;
  const baseSuggestions =
    question.suggestedAnswers.length > 0
      ? question.suggestedAnswers
      : deriveSuggestions(question.text);

  const recommended = question.recommendedAnswer?.trim() ?? '';
  const suggestions =
    recommended.length > 0 && !baseSuggestions.includes(recommended)
      ? [recommended, ...baseSuggestions]
      : baseSuggestions;

  return (
    <div
      className={cn(
        'group relative flex flex-col gap-2 overflow-hidden rounded-lg border border-warning/30 bg-warning/[0.06] py-2.5 pl-3 pr-2.5 shadow-sm',
        'transition-[border-color,background-color,box-shadow,transform] duration-200',
        !hasPendingAnswer && 'hover:border-warning/50',
        animate
          ? 'motion-safe:animate-answer-lock motion-reduce:bg-success/5'
          : 'motion-safe:animate-fade-in',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-y-2 left-0 w-0.5 rounded-full transition-colors duration-200',
          hasPendingAnswer ? 'bg-primary/70' : 'bg-warning/60',
        )}
      />

      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <MessageCircleQuestion size={13} aria-hidden className="mt-0.5 shrink-0 text-warning" />
          <Markdown
            text={question.text}
            className="min-w-0 gap-1.5 break-words text-[13px] font-medium leading-relaxed text-foreground"
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
          title="dismiss question"
          aria-label="dismiss question"
        >
          {animate ? <Check size={12} className="text-success" /> : <X size={12} />}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 pl-[21px]">
        {suggestions.map((suggestion) => (
          <SuggestionChip
            key={suggestion}
            label={suggestion}
            selected={selectedSuggestions.includes(suggestion)}
            recommended={recommended.length > 0 && suggestion === recommended}
            onToggle={() => onToggleSuggestion(question.id, suggestion)}
          />
        ))}
        <CustomAnswerField
          value={customAnswer}
          open={showCustomField}
          onToggle={() => onToggleCustomField(question.id)}
          onChange={(text) => onSetCustomAnswer(question.id, text)}
        />
      </div>

      <div className="flex items-center gap-2 pl-[21px] text-2xs text-muted-foreground">
        <span>{relativeAge(question.createdAt)}</span>
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
  );
};
