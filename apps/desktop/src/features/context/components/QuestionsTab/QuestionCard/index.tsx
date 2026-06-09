import { useEffect, useState } from 'react';
import { Check, MessageCircleQuestion, X } from 'lucide-react';
import { cn } from '@goodboy/ui';
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
  const suggestions =
    question.suggestedAnswers.length > 0
      ? question.suggestedAnswers
      : deriveSuggestions(question.text);

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-lg border bg-elevated pl-3 pr-2.5 py-2.5 shadow-sm',
        'transition-all duration-200 motion-safe:animate-fade-in',
        hasPendingAnswer ? 'border-primary/40' : 'border-border-soft hover:border-border',
        animate && 'scale-[1.01] border-primary/60 bg-primary/5',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'absolute inset-y-2 left-0 w-0.5 rounded-full transition-colors duration-200',
          hasPendingAnswer ? 'bg-primary' : 'bg-transparent',
        )}
      />

      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <MessageCircleQuestion
            size={13}
            aria-hidden
            className="mt-0.5 shrink-0 text-muted-foreground/50"
          />
          <p className="text-xs leading-relaxed text-foreground">{question.text}</p>
        </div>
        <button
          type="button"
          onClick={() => onDismiss(question.id)}
          className={cn(
            'shrink-0 rounded-md p-1 text-muted-foreground/60 opacity-0 transition-all',
            'hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40',
            'group-hover:opacity-100',
            animate && 'opacity-100',
          )}
          title="dismiss question"
          aria-label="dismiss question"
        >
          {animate ? <Check size={12} className="text-primary" /> : <X size={12} />}
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-[21px]">
        {suggestions.map((suggestion) => (
          <SuggestionChip
            key={suggestion}
            label={suggestion}
            selected={selectedSuggestions.includes(suggestion)}
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

      <div className="mt-2 flex items-center gap-2 pl-[21px] text-[10px] text-muted-foreground/70">
        <span>{relativeAge(question.createdAt)}</span>
        {question.ownedByStepOrdinal != null && (
          <span className="rounded bg-muted px-1 py-0.5 font-mono">
            step {question.ownedByStepOrdinal}
          </span>
        )}
        {question.workflowId && question.ownedByStepOrdinal != null && <span>delegated</span>}
      </div>
    </div>
  );
};
