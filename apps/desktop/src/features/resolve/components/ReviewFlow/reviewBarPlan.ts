import type { ResolveWord } from '../../commentProjection';
import type { ReviewCommentState } from '../../reviewCommentState';

export type BarVariant = 'primary' | 'secondary' | 'ghost';

export type BarItem =
  | { readonly kind: 'action'; readonly id: string; readonly variant: BarVariant }
  | { readonly kind: 'retryPush' }
  | { readonly kind: 'viewOnHost' }
  | { readonly kind: 'transcript' }
  | { readonly kind: 'stop' };

type PlanAction = {
  readonly id: string;
  readonly slot: string;
};

const action = (id: string, variant: BarVariant): BarItem => ({ kind: 'action', id, variant });

const SKIP = action('reviewComment.skip', 'ghost');

const PLANS: Partial<Record<ResolveWord, ReadonlyArray<BarItem>>> = {
  open: [action('reviewComment.draft', 'primary'), action('reviewComment.reply', 'ghost'), SKIP],
  question: [action('reviewComment.answer', 'primary'), SKIP],
  push_failed: [{ kind: 'retryPush' }, SKIP],
  working: [{ kind: 'transcript' }, { kind: 'stop' }],
  ready: [action('reviewComment.undo', 'secondary')],
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
}: {
  readonly word: ResolveWord;
  readonly state: ReviewCommentState;
}): ReadonlyArray<BarItem> | null => {
  if (word === 'to_review') {
    return state === 'outdated' ? OUTDATED : TO_REVIEW;
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
  hasRemote,
  actions,
}: {
  readonly word: ResolveWord;
  readonly state: ReviewCommentState;
  readonly hasRemote: boolean;
  readonly actions: ReadonlyArray<PlanAction>;
}): ReadonlyArray<BarItem> => {
  const items = hasRemote ? null : stateItemsOf({ word, state });
  if (items === null) {
    return genericPlanOf({ actions });
  }
  const actionIds = new Set(actions.map((candidate) => candidate.id));
  const available = items.filter((item) => hasPlace({ item, actionIds }));
  const hasReplyOnly = available.some(
    (item) => item.kind === 'action' && item.id === 'reviewComment.replyOnly',
  );
  return available.filter(
    (item) => !(hasReplyOnly && item.kind === 'action' && item.id === 'reviewComment.reply'),
  );
};
