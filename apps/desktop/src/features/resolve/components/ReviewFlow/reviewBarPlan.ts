import type { CommentLane } from '../../commentLaneOf';
import type { ResolveWord } from '../../commentProjection';
import type { ReviewCommentState } from '../../reviewCommentState';

export type BarVariant = 'primary' | 'secondary' | 'ghost';

export type BarItem =
  | { readonly kind: 'action'; readonly id: string; readonly variant: BarVariant }
  | { readonly kind: 'retryPush' }
  | { readonly kind: 'pushOnly' }
  | { readonly kind: 'viewOnHost' }
  | { readonly kind: 'transcript' }
  | { readonly kind: 'stop' };

type PlanAction = {
  readonly id: string;
  readonly slot: string;
};

type PlacedParams = {
  readonly list: ReadonlyArray<BarItem>;
};

const action = (id: string, variant: BarVariant): BarItem => ({ kind: 'action', id, variant });

const SKIP = action('reviewComment.skip', 'ghost');

const PLANS: Partial<Record<ResolveWord, ReadonlyArray<BarItem>>> = {
  open: [action('reviewComment.draft', 'primary'), action('reviewComment.reply', 'ghost'), SKIP],
  question: [SKIP],
  push_failed: [{ kind: 'retryPush' }, SKIP],
  working: [{ kind: 'transcript' }, { kind: 'stop' }],
  ready: [action('reviewComment.undo', 'secondary'), { kind: 'pushOnly' }],
  left_open: [action('reviewComment.undo', 'secondary')],
  done: [{ kind: 'viewOnHost' }],
};

const TO_REVIEW: ReadonlyArray<BarItem> = [
  action('reviewComment.accept', 'primary'),
  action('reviewComment.replyOnly', 'secondary'),
  action('reviewComment.reply', 'ghost'),
  action('reviewComment.editReply', 'ghost'),
  SKIP,
];

const RUN_FIRST: ReadonlyArray<BarItem> = [
  action('reviewComment.startRun', 'primary'),
  action('reviewComment.reply', 'ghost'),
  SKIP,
];

const IN_RUN: ReadonlyArray<BarItem> = [
  action('reviewComment.openRun', 'primary'),
  action('reviewComment.reply', 'ghost'),
];

const IN_RUN_WORDS: ReadonlySet<ResolveWord> = new Set<ResolveWord>(['open', 'couldnt_fix']);

const OUTDATED: ReadonlyArray<BarItem> = [
  action('reviewComment.edit', 'primary'),
  action('reviewComment.keepDraft', 'secondary'),
  SKIP,
];

const genericPlanOf = ({
  actions,
}: {
  readonly actions: ReadonlyArray<PlanAction>;
}): ReadonlyArray<BarItem> => [
  ...actions
    .filter((candidate) => candidate.slot === 'primary')
    .map((candidate) => action(candidate.id, 'primary')),
  ...actions
    .filter((candidate) => candidate.slot === 'secondary')
    .map((candidate) => action(candidate.id, 'ghost')),
];

const stateItemsOf = ({
  word,
  state,
  lane,
}: {
  readonly word: ResolveWord;
  readonly state: ReviewCommentState;
  readonly lane: CommentLane | null;
}): ReadonlyArray<BarItem> | null => {
  if (word === 'to_review') {
    return state === 'outdated' ? OUTDATED : TO_REVIEW;
  }
  if (lane === 'in_run' && IN_RUN_WORDS.has(word)) {
    return IN_RUN;
  }
  if (lane === 'run' && word === 'open') {
    return RUN_FIRST;
  }
  return PLANS[word] ?? null;
};

const hasPlace = ({
  item,
  actionIds,
}: {
  readonly item: BarItem;
  readonly actionIds: ReadonlySet<string>;
}): boolean => item.kind !== 'action' || actionIds.has(item.id);

export const reviewBarPlanOf = ({
  word,
  state,
  lane,
  hasRemote,
  actions,
}: {
  readonly word: ResolveWord;
  readonly state: ReviewCommentState;
  readonly lane: CommentLane | null;
  readonly hasRemote: boolean;
  readonly actions: ReadonlyArray<PlanAction>;
}): ReadonlyArray<BarItem> => {
  const isStateOwned = word === 'to_review' || word === 'ready';
  const items = hasRemote && !isStateOwned ? null : stateItemsOf({ word, state, lane });
  if (items === null) {
    return genericPlanOf({ actions });
  }
  const actionIds = new Set(actions.map((candidate) => candidate.id));
  const placed = ({ list }: PlacedParams): ReadonlyArray<BarItem> =>
    list.filter((item) => hasPlace({ item, actionIds }));
  const planned = placed({ list: items });
  const hasPrimary = planned.some((item) => item.kind === 'action' && item.variant === 'primary');
  const available =
    items === RUN_FIRST && !hasPrimary ? placed({ list: PLANS[word] ?? [] }) : planned;
  const hasReplyOnly = available.some(
    (item) => item.kind === 'action' && item.id === 'reviewComment.replyOnly',
  );
  return available.filter(
    (item) => !(hasReplyOnly && item.kind === 'action' && item.id === 'reviewComment.reply'),
  );
};
