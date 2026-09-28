import { useCallback } from 'react';
import type { Agent, OpenQuestion, OpenQuestionId, SessionId } from '@goodboy/types';
import { useAppStore, useSessionOpenQuestions } from '../../../../store';
import type { QuestionDelegateRequest } from '../../../../store/slices/open-questions/spawnQuestionDelegates';
import { partitionDelegatedQuestions } from '../../questionDelegate';
import {
  askerOf,
  askerQuestions,
  isGroupStaged,
} from '../../components/QuestionsTab/askerQuestions';
import {
  deriveDraftAnswer,
  isDraftReady,
  useOpenQuestions,
  type QuestionDraft,
} from '../../components/QuestionsTab/useOpenQuestions';

type Params = {
  readonly sessionId: SessionId;
};

export type AnswerQuestionControls = {
  readonly answer: (question: OpenQuestion) => Promise<void>;
  readonly undo: (questionId: OpenQuestionId) => void;
};

const NO_AGENTS: ReadonlyArray<Agent> = [];

type RequestsParams = {
  readonly questions: ReadonlyArray<OpenQuestion>;
  readonly drafts: Readonly<Record<string, QuestionDraft>>;
};

const delegateRequestsFor = ({
  questions,
  drafts,
}: RequestsParams): ReadonlyArray<QuestionDelegateRequest> =>
  questions.flatMap((question): ReadonlyArray<QuestionDelegateRequest> => {
    const intent = drafts[question.id]?.answerIntent;
    if (intent?.kind !== 'agent') {
      return [];
    }
    return [
      {
        question,
        hints: intent.hints,
        provider: intent.routing.provider,
        model: intent.routing.model,
        effort: intent.routing.effort,
      },
    ];
  });

export const useAnswerQuestion = ({ sessionId }: Params): AnswerQuestionControls => {
  const openQuestions = useSessionOpenQuestions(sessionId);
  const agents = useAppStore((state) => state.sessionPhaseRuns?.[sessionId] ?? NO_AGENTS);
  const answerOpenQuestions = useAppStore((state) => state.answerOpenQuestions);
  const spawnQuestionDelegates = useAppStore((state) => state.spawnQuestionDelegates);
  const stageAnswer = useOpenQuestions((state) => state.stageAnswer);
  const unstageAnswer = useOpenQuestions((state) => state.unstageAnswer);
  const flashAnswered = useOpenQuestions((state) => state.flashAnswered);
  const clearDraft = useOpenQuestions((state) => state.clearDraft);

  const answer = useCallback(
    async (question: OpenQuestion) => {
      const { drafts, staged } = useOpenQuestions.getState();
      if (!isDraftReady(drafts[question.id])) {
        return;
      }
      stageAnswer(question.id);
      const nowStaged = staged.includes(question.id) ? staged : [...staged, question.id];
      const open = openQuestions.filter((candidate) => candidate.status === 'open');
      const { answerable } = partitionDelegatedQuestions({ questions: open, agents });
      const askerId = askerOf(question);
      const fromStore = askerQuestions({ questions: answerable, askerId });
      const group = fromStore.some((candidate) => candidate.id === question.id)
        ? fromStore
        : [...fromStore, question];
      if (!isGroupStaged({ group, staged: nowStaged })) {
        return;
      }
      const pairs = group
        .map((candidate) => ({
          id: candidate.id,
          text: candidate.text,
          answer: deriveDraftAnswer(drafts[candidate.id]),
        }))
        .filter((pair) => pair.answer.length > 0);
      const requests = delegateRequestsFor({ questions: group, drafts });
      flashAnswered(pairs.map((pair) => pair.id));
      if (requests.length > 0) {
        const outcomes = await spawnQuestionDelegates({ sessionId, requests });
        for (const outcome of outcomes) {
          if (outcome.kind === 'spawned' || outcome.kind === 'already-running') {
            clearDraft(outcome.questionId);
            continue;
          }
          unstageAnswer(outcome.questionId);
        }
      }
      await answerOpenQuestions(sessionId, pairs, askerId);
    },
    [
      agents,
      answerOpenQuestions,
      clearDraft,
      flashAnswered,
      openQuestions,
      sessionId,
      spawnQuestionDelegates,
      stageAnswer,
      unstageAnswer,
    ],
  );

  return { answer, undo: unstageAnswer };
};
