import type { OpenQuestion, ResolveAttempt } from '@goodboy/types';
import { openQuestionOf } from '../../../../store/slices/resolve/answerQuestions';
import type { FixRun } from './activeFixRun';
import type { ReviewEntry } from './useReviewEntries';

type BulkAnswerOption = {
  readonly answer: string;
  readonly isRecommended: boolean;
};

export type BulkQuestion = {
  readonly threadId: string;
  readonly entry: ReviewEntry;
  readonly text: string;
  readonly recommended: string;
  readonly options: ReadonlyArray<BulkAnswerOption>;
};

export const bulkQuestionsOf = ({
  run,
  questions,
  attempts,
}: {
  readonly run: FixRun;
  readonly questions: ReadonlyArray<OpenQuestion>;
  readonly attempts: ReadonlyArray<ResolveAttempt>;
}): ReadonlyArray<BulkQuestion> =>
  run.entries.flatMap((entry): ReadonlyArray<BulkQuestion> => {
    if (entry.resolveWord !== 'needs_you') {
      return [];
    }
    const open = openQuestionOf({
      questions,
      attempts,
      threadId: entry.threadId,
      question: entry.row.thread.question,
    });
    const recommended = open?.recommendedAnswer;
    if (open === undefined || recommended === undefined || recommended.trim() === '') {
      return [];
    }
    const others = open.suggestedAnswers.filter((answer) => answer !== recommended);
    return [
      {
        threadId: entry.threadId,
        entry,
        text: open.text,
        recommended,
        options: [
          { answer: recommended, isRecommended: true },
          ...others.map((answer) => ({ answer, isRecommended: false })),
        ],
      },
    ];
  });
