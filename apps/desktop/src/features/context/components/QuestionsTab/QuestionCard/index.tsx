import { useEffect, useState } from 'react';
import { X, Check } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { OpenQuestion, OpenQuestionId } from '@goodboy/types';
import { SuggestionChip } from '../SuggestionChip';
import { CustomAnswerField } from '../CustomAnswerField';

interface Props {
  question: OpenQuestion;
  selectedSuggestions: ReadonlyArray<string>;
  customAnswer: string;
  showCustomField: boolean;
  justAnswered: boolean;
  collapsed: boolean;
  onToggleSuggestion: (questionId: OpenQuestionId, suggestion: string) => void;
  onSetCustomAnswer: (questionId: OpenQuestionId, text: string) => void;
  onToggleCustomField: (questionId: OpenQuestionId) => void;
  onDismiss: (id: OpenQuestionId) => void;
  onClearJustAnswered: (id: OpenQuestionId) => void;
}

function relativeAge(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function QuestionCard({
  question,
  selectedSuggestions,
  customAnswer,
  showCustomField,
  justAnswered,
  collapsed,
  onToggleSuggestion,
  onSetCustomAnswer,
  onToggleCustomField,
  onDismiss,
  onClearJustAnswered,
}: Props) {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (!justAnswered) return;
    setAnimate(true);
    const t = setTimeout(() => {
      setAnimate(false);
      onClearJustAnswered(question.id);
    }, 800);
    return () => clearTimeout(t);
  }, [justAnswered, question.id, onClearJustAnswered]);

  const hasPendingAnswer = selectedSuggestions.length > 0 || customAnswer.trim().length > 0;

  if (collapsed) {
    return (
      <div
        className={cn(
          'flex items-center justify-between gap-2 rounded-md border border-border/30 bg-muted/30 px-2.5 py-1.5',
          'transition-all duration-150',
        )}
      >
        <span className="truncate text-xs text-foreground">{question.text}</span>
        <div className="flex shrink-0 items-center gap-1">
          {hasPendingAnswer && (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
              {selectedSuggestions.length + (customAnswer.trim() ? 1 : 0)}
            </span>
          )}
          <button
            type="button"
            onClick={() => onDismiss(question.id)}
            className="rounded-sm p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none"
            title="dismiss question"
          >
            <X size={11} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-md border border-border/30 bg-muted/30 p-2.5',
        'transition-all duration-200',
        animate && 'scale-[1.02] border-primary/40 bg-primary/5',
      )}
    >
      {/* header row */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs leading-relaxed text-foreground">{question.text}</p>
        <button
          type="button"
          onClick={() => onDismiss(question.id)}
          className={cn(
            'mt-0.5 shrink-0 rounded-sm p-0.5 text-muted-foreground',
            'hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40',
            'transition-colors',
          )}
          title="dismiss question"
        >
          {animate ? <Check size={12} className="text-primary" /> : <X size={12} />}
        </button>
      </div>

      {/* chips + custom field */}
      <div className="flex flex-wrap gap-1.5">
        {question.suggestedAnswers.map((suggestion) => (
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

      {/* meta row */}
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <span>{relativeAge(question.createdAt)}</span>
        {question.ownedByStepOrdinal != null && (
          <span className="rounded bg-muted px-1 py-0.5 font-mono">
            step {question.ownedByStepOrdinal}
          </span>
        )}
        {question.workflowId && question.ownedByStepOrdinal != null && (
          <span className="text-muted-foreground/70">delegated</span>
        )}
      </div>
    </div>
  );
}
