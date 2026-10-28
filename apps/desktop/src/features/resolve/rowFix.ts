import type { ResolveQueueRow } from './buildResolveQueueRows';
import type { ResolveCommentProjection } from './commentProjection';
import type { ReviewCommentState } from './reviewCommentState';
import { threadFixSha } from './threadFixSha';

export type RowFix =
  | { readonly kind: 'fixing' }
  | {
      readonly kind: 'fixed';
      readonly sha: string;
      readonly commit: string;
      readonly isReview: boolean;
    }
  | { readonly kind: 'failed'; readonly sentence: string };

const SHORT_SHA_LENGTH = 7;

const FIXED_STATES: ReadonlySet<ReviewCommentState> = new Set([
  'ready',
  'edited',
  'outdated',
  'accepted',
  'pushed',
]);

const REVIEW_STATES: ReadonlySet<ReviewCommentState> = new Set(['ready', 'edited', 'outdated']);

type Params = {
  readonly state: ReviewCommentState;
  readonly row: ResolveQueueRow;
  readonly projection: Pick<ResolveCommentProjection, 'word' | 'sentence'>;
};

type ShaParams = {
  readonly sha: string;
};

export const shortShaOf = ({ sha }: ShaParams): string => sha.slice(0, SHORT_SHA_LENGTH);

export const rowFixOf = ({ state, row, projection }: Params): RowFix | null => {
  if (state === 'drafting') {
    return { kind: 'fixing' };
  }
  if (state === 'failed') {
    return projection.word === 'couldnt_fix' && projection.sentence !== null
      ? { kind: 'failed', sentence: projection.sentence }
      : null;
  }
  if (!FIXED_STATES.has(state)) {
    return null;
  }
  const sha = threadFixSha({
    commitShas: row.thread.commitShas,
    integratedSha: row.item.integratedSha,
  });
  return sha === null
    ? null
    : { kind: 'fixed', sha: shortShaOf({ sha }), commit: sha, isReview: REVIEW_STATES.has(state) };
};
