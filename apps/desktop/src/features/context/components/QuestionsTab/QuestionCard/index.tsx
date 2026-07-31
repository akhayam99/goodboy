import { useEffect, useState } from 'react';
import { Check, MessageCircleQuestion, X } from 'lucide-react';
import { cn, Markdown, tintClasses } from '@goodboy/ui';
import type { OpenQuestion, OpenQuestionId } from '@goodboy/types';
import { formatRelativeAge } from '../../../../../shared/utils/relativeDate';
import { TranscriptShell } from '../../../../chat/components/TranscriptShell';
import { SuggestionChip } from '../SuggestionChip';
import { CustomAnswerField } from '../CustomAnswerField';
import { deriveSuggestions } from '../deriveSuggestions';

const warningTint = tintClasses('warning');

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
  const suggestions =
    recommended.length > 0 && !baseSuggestions.includes(recommended)
      ? [recommended, ...baseSuggestions]
      : baseSuggestions;

  return (
    <TranscriptShell
      tone="warning"
      variant="boxed"
      emphasis
      className={cn(
        'group flex flex-col gap-2 transition-[background-color,transform] duration-200',
        animate
          ? 'motion-safe:animate-answer-lock motion-reduce:bg-success/5'
          : 'motion-safe:animate-fade-in',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <MessageCircleQuestion
            size={14}
            aria-hidden
            className={cn('shrink-0 translate-y-0.5', warningTint.icon)}
          />
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

      <div className="flex flex-wrap items-center gap-1.5 pl-6">
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

      <div className="flex items-center gap-2 pl-6 text-2xs text-muted-foreground">
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
    </TranscriptShell>
  );
};
