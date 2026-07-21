import { useCallback, useState } from 'react';
import { Bot, CheckCircle2, ChevronDown } from 'lucide-react';
import { cn, Markdown } from '@goodboy/ui';
import type { OpenQuestion, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { QuestionCard } from '../../../context/components/QuestionsTab/QuestionCard';
import { useOpenQuestions } from '../../../context/components/QuestionsTab/useOpenQuestions';
import { MARKER_ACCENT } from '../marker-accents';

const RESOLVED_BY_AGENT = '[resolved by agent]';
const successAccent = MARKER_ACCENT.success;

type Props = {
  question: OpenQuestion;
  sessionId: SessionId;
};

function relativeTime(isoDate: string): string {
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

const InteractiveCard = ({ question, sessionId }: Props) => {
  const {
    drafts,
    justAnswered,
    toggleSuggestion,
    setCustomAnswer,
    toggleCustomField,
    clearJustAnswered,
  } = useOpenQuestions();
  const dismissOpenQuestion = useAppStore((s) => s.dismissOpenQuestion);

  const draft = drafts[question.id];

  const handleDismiss = useCallback(() => {
    void dismissOpenQuestion(sessionId, question);
  }, [dismissOpenQuestion, sessionId, question]);

  return (
    <div className="flex flex-col gap-2">
      <QuestionCard
        question={question}
        selectedSuggestions={draft?.selectedSuggestions ?? []}
        customAnswer={draft?.customAnswer ?? ''}
        showCustomField={draft?.showCustomField ?? false}
        justAnswered={justAnswered.includes(question.id)}
        onToggleSuggestion={toggleSuggestion}
        onSetCustomAnswer={setCustomAnswer}
        onToggleCustomField={toggleCustomField}
        onDismiss={handleDismiss}
        onClearJustAnswered={clearJustAnswered}
      />
    </div>
  );
};

export const AnsweredCard = ({ question }: { question: OpenQuestion }) => {
  const [expanded, setExpanded] = useState(false);
  const resolvedByAgent = question.userAnswer === RESOLVED_BY_AGENT;
  const answeredAt = question.answeredAt ?? question.createdAt;

  return (
    <div
      className={cn(
        'rounded-lg border bg-elevated px-3 py-2 shadow-sm',
        resolvedByAgent ? 'border-border-soft opacity-80' : successAccent.border,
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start justify-between gap-2 text-left"
      >
        <div className="flex min-w-0 items-start gap-2">
          {resolvedByAgent ? (
            <Bot size={13} aria-hidden className="mt-0.5 shrink-0 text-muted-foreground/60" />
          ) : (
            <CheckCircle2 size={13} aria-hidden className="mt-0.5 shrink-0 text-success" />
          )}
          {expanded ? (
            <Markdown
              text={question.text}
              className="min-w-0 gap-1.5 break-words text-[13px] leading-relaxed text-foreground"
            />
          ) : (
            <p className="min-w-0 break-words text-xs leading-relaxed text-foreground line-clamp-1">
              {question.text}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5 text-2xs text-muted-foreground">
          <span>{relativeTime(answeredAt)}</span>
          <ChevronDown
            size={12}
            aria-hidden
            className={cn('transition-transform duration-150', expanded && 'rotate-180')}
          />
        </div>
      </button>

      {expanded && (
        <div className="mt-2 pl-[21px]">
          {resolvedByAgent ? (
            <p className="text-2xs italic text-muted-foreground">resolved by agent</p>
          ) : (
            <>
              <span className="text-2xs font-medium text-muted-foreground">You answered:</span>
              <Markdown
                text={question.userAnswer ?? ''}
                className="mt-0.5 gap-1.5 break-words text-[13px] leading-relaxed text-foreground"
              />
            </>
          )}
        </div>
      )}
    </div>
  );
};

export const OpenQuestionInlineCard = ({ question, sessionId }: Props) => {
  return (
    <div data-oq-anchor={question.id}>
      {question.status === 'answered' ? (
        <AnsweredCard question={question} />
      ) : (
        <InteractiveCard question={question} sessionId={sessionId} />
      )}
    </div>
  );
};
