import type { Tone } from '@goodboy/ui';
import type { CommentOutcomeKind } from './commentOutcome';
import { RESOLVE_VOCAB, RESOLVE_WORD_LABEL } from './commentProjection';

export const OUTCOME_LABEL: Readonly<Record<CommentOutcomeKind, string>> = {
  waiting: 'Waiting',
  working: RESOLVE_WORD_LABEL.working,
  'fix-proposed': RESOLVE_WORD_LABEL.to_review,
  fixed: RESOLVE_VOCAB.applied,
  question: RESOLVE_WORD_LABEL.question,
  'no-change': RESOLVE_VOCAB.wontFix,
  failed: RESOLVE_WORD_LABEL.couldnt_fix,
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
  applyFix: RESOLVE_VOCAB.applyFix,
  discard: 'Discard',
  postReply: 'Post reply',
  closeNote: 'Close note',
  resolveWithoutReply: 'Resolve without reply',
  answer: 'Answer',
  askOnHost: 'Ask on GitHub',
  retry: 'Retry',
  reply: 'Reply',
  answerField: 'Your answer',
  working: 'The agent is working on this comment.',
  discarded: 'Fix discarded',
  discardConflict: 'This fix changed. Nothing changed.',
} as const;

type CountParams = {
  readonly count: number;
};

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
