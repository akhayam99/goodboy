import { useCallback } from 'react';
import { ArrowRight } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { OpenQuestion, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import {
  deriveDraftAnswer,
  useOpenQuestions,
} from '../../../context/components/QuestionsTab/useOpenQuestions';
import { OpenQuestionInlineCard } from './OpenQuestionInlineCard';

type Props = {
  questions: ReadonlyArray<OpenQuestion>;
  sessionId: SessionId;
};

export const OpenQuestionCluster = ({ questions, sessionId }: Props) => {
  const drafts = useOpenQuestions((s) => s.drafts);
  const flashAnswered = useOpenQuestions((s) => s.flashAnswered);
  const answerOpenQuestions = useAppStore((s) => s.answerOpenQuestions);

  const pendingPairs = questions
    .filter((q) => q.status !== 'answered')
    .map((q) => ({ id: q.id, text: q.text, answer: deriveDraftAnswer(drafts[q.id]) }))
    .filter((pair) => pair.answer.length > 0);
  const targetAgentId = questions[0]?.createdByAgentId ?? null;

  const handleSubmit = useCallback(async () => {
    if (pendingPairs.length === 0) {
      return;
    }
    flashAnswered(pendingPairs.map((pair) => pair.id));
    await answerOpenQuestions(sessionId, pendingPairs, targetAgentId);
  }, [pendingPairs, flashAnswered, answerOpenQuestions, sessionId, targetAgentId]);

  return (
    <div className="flex flex-col gap-2">
      {questions.map((q) => (
        <OpenQuestionInlineCard key={q.id} question={q} sessionId={sessionId} />
      ))}
      {pendingPairs.length > 0 && (
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
      )}
    </div>
  );
};
