import type { Tone } from '@goodboy/ui';
import type { CommentOutcomeKind } from './commentOutcome';

export const OUTCOME_LABEL: Readonly<Record<CommentOutcomeKind, string>> = {
  waiting: 'Waiting',
  working: 'Working',
  'fix-proposed': 'Fix proposed',
  fixed: 'Fixed',
  question: 'Question',
  'no-change': 'No change',
  failed: 'Failed',
};

export const OUTCOME_TONE: Readonly<Record<CommentOutcomeKind, Tone>> = {
  waiting: 'neutral',
  working: 'info',
  'fix-proposed': 'primary',
  fixed: 'success',
  question: 'warning',
  'no-change': 'neutral',
  failed: 'danger',
};

export const OUTCOME_ACTION = {
  applyFix: 'Apply fix',
  discard: 'Discard',
  postReply: 'Post reply',
  closeNote: 'Close note',
  resolveWithoutReply: 'Resolve without reply',
  answer: 'Answer',
  askOnHost: 'Ask on GitHub',
  tryAgain: 'Try again',
  reply: 'Reply',
  answerField: 'Your answer',
  working: 'The agent is working on this comment.',
  discarded: 'Fix discarded',
  discardConflict: 'This fix changed. Nothing changed.',
} as const;

type CountParams = {
  readonly count: number;
};

export const applyFixesLabel = ({ count }: CountParams): string =>
  `Apply ${count} ${count === 1 ? 'fix' : 'fixes'}`;

export const postRepliesLabel = ({ count }: CountParams): string =>
  `Post ${count} ${count === 1 ? 'reply' : 'replies'}`;

type ShaParams = {
  readonly sha: string;
};

export const fixedInLine = ({ sha }: ShaParams): string => `Fixed in ${sha}`;

type SummaryParams = {
  readonly fixes: number;
  readonly questions: number;
  readonly replies: number;
};

type PartParams = {
  readonly count: number;
  readonly one: string;
  readonly many: string;
};

const part = ({ count, one, many }: PartParams): ReadonlyArray<string> =>
  count === 0 ? [] : [`${count} ${count === 1 ? one : many}`];

export const outcomeSummaryLine = ({ fixes, questions, replies }: SummaryParams): string =>
  [
    ...part({ count: fixes, one: 'fix proposed', many: 'fixes proposed' }),
    ...part({ count: questions, one: 'question', many: 'questions' }),
    ...part({ count: replies, one: 'reply', many: 'replies' }),
  ].join(', ');
