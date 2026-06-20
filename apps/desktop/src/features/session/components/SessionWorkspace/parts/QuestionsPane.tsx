import { useCallback } from 'react';
import { ArrowRight, CircleCheck } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import { useAppStore, useSessionOpenQuestions } from '../../../../../store';
import { QuestionCard } from '../../../../context/components/QuestionsTab/QuestionCard';
import {
  deriveDraftAnswer,
  useOpenQuestions,
} from '../../../../context/components/QuestionsTab/useOpenQuestions';
import { selectOpenQuestions } from '../../SessionOverviewPane/lib';
import { PaneShell } from './PaneShell';

type QuestionsPaneProps = {
  readonly session: Session;
};

export const QuestionsPane = ({ session }: QuestionsPaneProps) => {
  const sessionId = session.id as SessionId;
  const open = selectOpenQuestions(useSessionOpenQuestions(sessionId));
  const drafts = useOpenQuestions((s) => s.drafts);
  const justAnswered = useOpenQuestions((s) => s.justAnswered);
  const toggleSuggestion = useOpenQuestions((s) => s.toggleSuggestion);
  const setCustomAnswer = useOpenQuestions((s) => s.setCustomAnswer);
  const toggleCustomField = useOpenQuestions((s) => s.toggleCustomField);
  const clearJustAnswered = useOpenQuestions((s) => s.clearJustAnswered);
  const flashAnswered = useOpenQuestions((s) => s.flashAnswered);
  const answerOpenQuestions = useAppStore((s) => s.answerOpenQuestions);
  const dismissOpenQuestion = useAppStore((s) => s.dismissOpenQuestion);

  const pendingPairs = open
    .map((q) => ({ id: q.id, text: q.text, answer: deriveDraftAnswer(drafts[q.id]) }))
    .filter((pair) => pair.answer.length > 0);
  const targetAgentId = open[0]?.createdByAgentId ?? null;

  const handleSubmit = useCallback(async () => {
    if (pendingPairs.length === 0) {
      return;
    }
    flashAnswered(pendingPairs.map((pair) => pair.id));
    await answerOpenQuestions(sessionId, pendingPairs, targetAgentId);
  }, [pendingPairs, flashAnswered, answerOpenQuestions, sessionId, targetAgentId]);

  if (open.length === 0) {
    return (
      <PaneShell title="Questions" description="Decisions agents need from you to keep going.">
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border-soft bg-elevated/40 px-6 py-12 text-center">
          <span
            aria-hidden
            className="flex size-12 items-center justify-center rounded-full bg-success/10"
          >
            <CircleCheck size={24} aria-hidden className="text-success" />
          </span>
          <p className="text-sm font-medium text-foreground">No open questions</p>
          <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
            When an agent needs a decision, it shows up here.
          </p>
        </div>
      </PaneShell>
    );
  }

  return (
    <PaneShell
      title="Questions"
      description={`${open.length} open ${open.length === 1 ? 'question' : 'questions'} waiting on you.`}
    >
      <div className="flex flex-col gap-3">
        {open.map((q) => (
          <QuestionCard
            key={q.id}
            question={q}
            selectedSuggestions={drafts[q.id]?.selectedSuggestions ?? []}
            customAnswer={drafts[q.id]?.customAnswer ?? ''}
            showCustomField={drafts[q.id]?.showCustomField ?? false}
            justAnswered={justAnswered.includes(q.id)}
            onToggleSuggestion={toggleSuggestion}
            onSetCustomAnswer={setCustomAnswer}
            onToggleCustomField={toggleCustomField}
            onDismiss={() => void dismissOpenQuestion(sessionId, q)}
            onClearJustAnswered={clearJustAnswered}
          />
        ))}
        {pendingPairs.length > 0 ? (
          <button
            type="button"
            onClick={() => void handleSubmit()}
            className={cn(
              'group flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold',
              'bg-primary text-primary-foreground shadow-sm transition-all duration-150',
              'hover:brightness-105 active:scale-[0.99]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
            )}
          >
            <span>
              {pendingPairs.length > 1 ? `send ${pendingPairs.length} answers` : 'send answer'}
            </span>
            <ArrowRight
              size={13}
              aria-hidden
              className="transition-transform group-hover:translate-x-0.5"
            />
          </button>
        ) : null}
      </div>
    </PaneShell>
  );
};
