import { countNoun } from '../../shared/utils/countNoun';
import { applyFixesLabel } from './commentProjection';

export const REVIEW_BULK_LABEL = {
  runActions: 'Fix run actions',
  acceptFailed: "Couldn't accept every comment",
  answersPanel: 'Answer the questions of the fix run',
  answerFor: 'Answer for',
  recommended: 'Recommended',
  drop: 'Drop',
  undoDrop: 'Undo',
  dropped: 'Dropped from this batch. It stays in Needs you.',
  answersLine: 'Recommended answers are preselected. They all go to the same fix run.',
  cancel: 'Cancel',
  undo: 'Undo',
} as const;

export const recommendedAnswersLabel = ({ count }: { readonly count: number }): string =>
  `Use the recommended answers (${count})`;

export const retryCouldntFixLabel = ({ count }: { readonly count: number }): string =>
  `Retry ${count} that couldn't fix`;

export const answersTitle = ({ count }: { readonly count: number }): string =>
  `Answer ${countNoun({ count, one: 'question', many: 'questions' })}`;

export const answersContinueLabel = ({ count }: { readonly count: number }): string =>
  `Continue with ${countNoun({ count, one: 'answer', many: 'answers' })}`;

export const acceptCountLabel = ({ count }: { readonly count: number }): string =>
  applyFixesLabel({ count });

export const acceptedLine = ({ count }: { readonly count: number }): string => `${count} accepted`;

export const bulkAcceptFailureLine = ({
  count,
  message,
}: {
  readonly count: number;
  readonly message: string;
}): string => `${countNoun({ count, one: 'comment', many: 'comments' })} not accepted. ${message}`;
