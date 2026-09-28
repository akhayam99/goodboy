import { useCallback, useMemo, useState } from 'react';
import type { Agent, OpenQuestion, OpenQuestionId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { LiveQuestionCard } from '../../../context/components/QuestionsTab/LiveQuestionCard';
import { askerOf, askerQuestions } from '../../../context/components/QuestionsTab/askerQuestions';
import { useOpenQuestions } from '../../../context/components/QuestionsTab/useOpenQuestions';
import { partitionDelegatedQuestions } from '../../../context/questionDelegate';
import { OpenQuestionInlineCard } from './OpenQuestionInlineCard';

const NO_AGENTS: ReadonlyArray<Agent> = [];

type Props = {
  readonly questions: ReadonlyArray<OpenQuestion>;
  readonly sessionId: SessionId;
};

type NextParams = {
  readonly list: ReadonlyArray<OpenQuestion>;
  readonly from: OpenQuestionId;
  readonly isEligible: (question: OpenQuestion) => boolean;
};

const nextAfter = ({ list, from, isEligible }: NextParams): OpenQuestion | null => {
  const start = list.findIndex((question) => question.id === from);
  for (let step = 1; step <= list.length; step += 1) {
    const candidate = list[(start + step) % list.length];
    if (candidate !== undefined && candidate.id !== from && isEligible(candidate)) {
      return candidate;
    }
  }
  return null;
};

export const OpenQuestionCluster = ({ questions, sessionId }: Props) => {
  const agents = useAppStore((s) => s.sessionPhaseRuns?.[sessionId] ?? NO_AGENTS);
  const dismissOpenQuestion = useAppStore((s) => s.dismissOpenQuestion);
  const staged = useOpenQuestions((s) => s.staged);
  const [currentId, setCurrentId] = useState<OpenQuestionId | null>(null);

  const { openQuestions, settled } = useMemo(
    () => ({
      openQuestions: questions.filter((q) => q.status === 'open'),
      settled: questions.filter((q) => q.status !== 'open'),
    }),
    [questions],
  );
  const { waiting, answerable } = useMemo(
    () => partitionDelegatedQuestions({ questions: openQuestions, agents }),
    [openQuestions, agents],
  );

  const current =
    answerable.find((question) => question.id === currentId) ??
    answerable.find((question) => !staged.includes(question.id)) ??
    answerable[0] ??
    null;
  const group =
    current === null ? [] : askerQuestions({ questions: answerable, askerId: askerOf(current) });
  const position = current === null ? -1 : group.findIndex((q) => q.id === current.id);

  const handleAnswered = useCallback(
    (question: OpenQuestion) => {
      const next = nextAfter({
        list: answerable,
        from: question.id,
        isEligible: (candidate) => !staged.includes(candidate.id),
      });
      setCurrentId(next?.id ?? null);
    },
    [answerable, staged],
  );

  const handleSkip =
    current === null || answerable.length < 2
      ? null
      : () => {
          const next = nextAfter({ list: answerable, from: current.id, isEligible: () => true });
          setCurrentId(next?.id ?? null);
        };

  const pager =
    current === null || group.length < 2
      ? null
      : {
          index: position,
          doneFlags: group.map((question) => staged.includes(question.id)),
          onPrevious: () => setCurrentId(group[position - 1]?.id ?? current.id),
          onNext: () => setCurrentId(group[position + 1]?.id ?? current.id),
        };

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {settled.map((q) => (
        <OpenQuestionInlineCard key={q.id} question={q} sessionId={sessionId} />
      ))}
      {waiting.map((q) => (
        <LiveQuestionCard key={q.id} question={q} sessionId={sessionId} variant="compact" />
      ))}
      {current !== null && (
        <LiveQuestionCard
          key={current.id}
          question={current}
          sessionId={sessionId}
          variant="compact"
          pager={pager}
          onAnswered={handleAnswered}
          onSkip={handleSkip}
          onDismiss={() => void dismissOpenQuestion(sessionId, current)}
        />
      )}
    </div>
  );
};
