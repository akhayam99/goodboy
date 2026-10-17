import { useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import { useActionEnv } from '../../../../actions/useActionEnv';
import { useObjectActions } from '../../../../actions/useObjectActions';
import type { ResolvedAction, ReviewCommentActionTarget } from '../../../../actions/types';
import { reviewBarPlanOf, type BarItem } from '../../ReviewFlow/reviewBarPlan';
import type { ReviewPush } from '../../ReviewFlow/useReviewPush';
import type { ReviewEntry } from '../../ReviewFlow/useReviewEntries';
import { COMMENT_DRAWER_VERB } from '../commentDrawerVerbs';

type Params = {
  readonly sessionId: SessionId;
  readonly entry: ReviewEntry;
  readonly push: ReviewPush;
  readonly hasRunLine: boolean;
};

type RunReviewParams = {
  readonly actionId: string;
};

export type CommentDrawerPlan = {
  readonly target: ReviewCommentActionTarget;
  readonly items: ReadonlyArray<BarItem>;
  readonly actions: ReadonlyArray<ResolvedAction>;
  readonly pushAction: ResolvedAction | undefined;
  readonly runReview: (params: RunReviewParams) => Promise<void>;
  readonly isPushInFlight: boolean;
  readonly rare: ReadonlyArray<ResolvedAction>;
  readonly shown: ReadonlyArray<string>;
};

type ItemIdParams = {
  readonly item: BarItem;
};

const idOf = ({ item }: ItemIdParams): string => {
  switch (item.kind) {
    case 'action':
      return item.id;
    case 'retryPush':
      return COMMENT_DRAWER_VERB.push;
    case 'pushOnly':
      return COMMENT_DRAWER_VERB.pushOnly;
    case 'viewOnHost':
      return COMMENT_DRAWER_VERB.openHost;
    case 'transcript':
      return COMMENT_DRAWER_VERB.transcript;
    case 'stop':
      return COMMENT_DRAWER_VERB.stop;
    default: {
      const exhaustive: never = item;
      return exhaustive;
    }
  }
};

export const useCommentDrawerPlan = ({
  sessionId,
  entry,
  push,
  hasRunLine,
}: Params): CommentDrawerPlan => {
  const { threadId, state } = entry;
  const target = useMemo(
    () => ({ kind: 'reviewComment' as const, sessionId, threadId }),
    [sessionId, threadId],
  );
  const reviewTarget = useMemo(() => ({ kind: 'review' as const, sessionId }), [sessionId]);
  const env = useActionEnv({ origin: 'button' });
  const { actions } = useObjectActions({ target, env });
  const { actions: reviewActions, run: runReview } = useObjectActions({
    target: reviewTarget,
    env,
  });
  const pushAction = reviewActions.find((candidate) => candidate.id === COMMENT_DRAWER_VERB.push);
  const isPushInFlight =
    push.phase.kind === 'preparing' ||
    push.phase.kind === 'pushing' ||
    push.phase.kind === 'syncing';
  const isPushPanelShown =
    push.phase.kind === 'confirm' ||
    push.phase.kind === 'sync_confirm' ||
    (push.phase.kind === 'pushing' && push.phase.hasPanel);
  const items = useMemo(() => {
    const ids = new Set(actions.map((candidate) => candidate.id));
    const plan = reviewBarPlanOf({
      word: entry.resolveWord,
      state,
      hasRemote: entry.remote !== null,
      actions: actions.map((candidate) => ({ id: candidate.id, slot: candidate.slot })),
    });
    return plan.filter((item) => {
      switch (item.kind) {
        case 'retryPush':
          return pushAction !== undefined;
        case 'pushOnly':
          return pushAction !== undefined && entry.remote !== 'on_origin' && !isPushPanelShown;
        case 'viewOnHost':
          return ids.has(COMMENT_DRAWER_VERB.openHost);
        case 'transcript':
          return !hasRunLine && ids.has(COMMENT_DRAWER_VERB.transcript);
        case 'stop':
          return !hasRunLine && ids.has(COMMENT_DRAWER_VERB.stop);
        case 'action':
          return true;
        default: {
          const exhaustive: never = item;
          return exhaustive;
        }
      }
    });
  }, [actions, entry.remote, entry.resolveWord, hasRunLine, isPushPanelShown, pushAction, state]);
  const shown = useMemo(() => items.map((item) => idOf({ item })), [items]);
  const rare = useMemo(
    () => actions.filter((candidate) => !shown.includes(candidate.id)),
    [actions, shown],
  );
  return { target, items, actions, pushAction, runReview, isPushInFlight, rare, shown };
};
