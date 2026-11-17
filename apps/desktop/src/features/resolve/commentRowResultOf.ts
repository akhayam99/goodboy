import type { ItemWorkState } from '../live-state/itemWork/itemWorkWords';
import { fixedInLine } from './commentOutcomeCopy';
import type { ResolveWord } from './commentProjection';
import type { ReviewCommentState } from './reviewCommentState';
import type { RowFix } from './rowFix';

export type CommentRowAction = 'reviewApply' | 'retry' | 'openChanges';

export type CommentRowResult = {
  readonly state: ItemWorkState;
  readonly detail: string | null;
  readonly action: CommentRowAction;
};

type Params = {
  readonly state: ReviewCommentState;
  readonly resolveWord: ResolveWord;
  readonly fix: RowFix | null;
  readonly isStopped: boolean;
  readonly isPushing: boolean;
};

const APPLIED_DETAIL = 'the next push sends it';

export const commentRowResultOf = ({
  state,
  resolveWord,
  fix,
  isStopped,
  isPushing,
}: Params): CommentRowResult | null => {
  if (fix === null) {
    return null;
  }
  if (fix.kind === 'failed') {
    return resolveWord === 'couldnt_fix'
      ? { state: isStopped ? 'stopped' : 'failed', detail: fix.sentence, action: 'retry' }
      : null;
  }
  if (resolveWord === 'to_review' && (state === 'ready' || state === 'edited')) {
    return { state: 'fixReady', detail: fixedInLine({ sha: fix.sha }), action: 'reviewApply' };
  }
  if (resolveWord === 'ready' && state === 'accepted' && !isPushing) {
    return {
      state: 'appliedNotPushed',
      detail: `${fixedInLine({ sha: fix.sha })}, ${APPLIED_DETAIL}`,
      action: 'openChanges',
    };
  }
  return null;
};
