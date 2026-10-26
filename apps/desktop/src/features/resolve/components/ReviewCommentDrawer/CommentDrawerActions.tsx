import type { ReactNode } from 'react';
import { ArrowUp, SquareArrowOutUpRight } from 'lucide-react';
import { REVIEW_SOURCE_LABEL } from '@goodboy/core';
import { Button, FormActions, ICON_SIZE, KeyHint, Tooltip } from '@goodboy/ui';

import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import type { ResolvedAction } from '../../../actions/types';
import type { ReviewCommentBinding } from '../../hooks/useReviewCommentController';
import { BAR_COPY } from '../../commentStateCopy';
import { PUSH_ONLY_LABEL } from '../../reviewPushCopy';
import type { BarItem, BarVariant } from '../ReviewFlow/reviewBarPlan';
import { StopRunButton } from '../ReviewFlow/StopRunButton';
import type { ReviewPush } from '../ReviewFlow/useReviewPush';
import type { ReviewEntry } from '../ReviewFlow/useReviewEntries';
import { COMMENT_DRAWER_VERB } from './commentDrawerVerbs';
import { REVIEW_COMMENT_DRAWER_COPY } from './reviewCommentDrawerCopy';
import type { CommentDrawerPlan } from './useCommentDrawerPlan';

type Props = {
  readonly entry: ReviewEntry;
  readonly push: ReviewPush;
  readonly plan: CommentDrawerPlan;
  readonly lone: ResolvedAction | null;
  readonly extra: ReactNode;
  readonly binding: Pick<
    ReviewCommentBinding,
    | 'compose'
    | 'isEditingReply'
    | 'pendingActionId'
    | 'isSubmitting'
    | 'onRun'
    | 'error'
    | 'failedActionId'
  >;
};

type VerbParams = {
  readonly action: ResolvedAction;
  readonly variant: BarVariant;
};

type ItemParams = {
  readonly item: BarItem;
};

export const CommentDrawerActions = ({ entry, push, plan, lone, extra, binding }: Props) => {
  const { pendingActionId, failedActionId, error } = binding;
  const isIdle = binding.compose === null && !binding.isEditingReply;
  const isBusy = pendingActionId !== null || binding.isSubmitting;
  const host = REVIEW_SOURCE_LABEL[entry.row.thread.sourceKind ?? 'github'];
  if (!isIdle) {
    return null;
  }

  const verbButton = ({ action, variant }: VerbParams): ReactNode => {
    const isFailed = failedActionId === action.id && error !== null;
    const isBlocked = action.blockedReason !== null;
    const button = (
      <Button
        key={action.id}
        size="sm"
        variant={variant}
        data-review-verb={action.id}
        disabled={isBlocked || (pendingActionId !== null && pendingActionId !== action.id)}
        isBusy={pendingActionId === action.id}
        onClick={() => binding.onRun(action.id)}
      >
        {isFailed ? REVIEW_COMMENT_DRAWER_COPY.retry : action.label}
        {action.shortcut === null || isBlocked ? null : (
          <KeyHint keys={shortcutGlyphs(action.shortcut)} isOnTone={variant === 'primary'} />
        )}
      </Button>
    );
    if (!isBlocked) {
      return button;
    }
    return (
      <Tooltip key={action.id} content={action.blockedReason} anchorClassName="inline-flex">
        {button}
      </Tooltip>
    );
  };

  const render = ({ item }: ItemParams): ReactNode => {
    switch (item.kind) {
      case 'action': {
        const action = plan.actions.find((candidate) => candidate.id === item.id);
        return action === undefined ? null : verbButton({ action, variant: item.variant });
      }
      case 'retryPush':
        return (
          <Button
            key="retryPush"
            size="sm"
            variant="primary"
            data-review-verb={COMMENT_DRAWER_VERB.push}
            disabled={
              plan.pushAction === undefined || plan.pushAction.blockedReason !== null || isBusy
            }
            onClick={() => void plan.runReview({ actionId: COMMENT_DRAWER_VERB.push })}
          >
            {BAR_COPY.retryPush}
          </Button>
        );
      case 'pushOnly':
        return (
          <Button
            key="pushOnly"
            size="sm"
            variant="ghost"
            data-review-verb={COMMENT_DRAWER_VERB.pushOnly}
            disabled={
              plan.pushAction === undefined ||
              plan.pushAction.blockedReason !== null ||
              isBusy ||
              plan.isPushInFlight
            }
            onClick={() => void push.arm({ isRetry: false, threadIds: [entry.threadId] })}
          >
            <ArrowUp size={ICON_SIZE.control} aria-hidden />
            {PUSH_ONLY_LABEL}
          </Button>
        );
      case 'viewOnHost':
        return (
          <Button
            key="viewOnHost"
            size="sm"
            variant="secondary"
            data-review-verb={COMMENT_DRAWER_VERB.openHost}
            onClick={() => binding.onRun(COMMENT_DRAWER_VERB.openHost)}
          >
            <SquareArrowOutUpRight size={ICON_SIZE.control} aria-hidden />
            {BAR_COPY.viewOn({ host })}
          </Button>
        );
      case 'transcript':
        return (
          <Button
            key="transcript"
            size="sm"
            variant="secondary"
            data-review-verb={COMMENT_DRAWER_VERB.transcript}
            onClick={() => binding.onRun(COMMENT_DRAWER_VERB.transcript)}
          >
            {BAR_COPY.openTranscript}
          </Button>
        );
      case 'stop':
        return <StopRunButton key="stop" onStop={() => binding.onRun(COMMENT_DRAWER_VERB.stop)} />;
      default: {
        const exhaustive: never = item;
        return exhaustive;
      }
    }
  };

  const isFailureShown =
    failedActionId !== null &&
    (plan.shown.includes(failedActionId) || failedActionId === COMMENT_DRAWER_VERB.postReplyNow);
  const retry =
    error === null || failedActionId === null || isFailureShown ? null : (
      <Button
        key="retry"
        size="sm"
        variant="secondary"
        data-review-verb="retry"
        disabled={isBusy}
        onClick={() => binding.onRun(failedActionId)}
      >
        {REVIEW_COMMENT_DRAWER_COPY.retry}
      </Button>
    );
  const leading =
    extra === null && lone === null ? null : (
      <>
        {extra}
        {lone === null ? null : verbButton({ action: lone, variant: 'ghost' })}
      </>
    );
  if (plan.items.length === 0 && leading === null && error === null) {
    return null;
  }
  return (
    <FormActions
      leading={leading}
      error={error === null ? null : <span data-review-error="">{error}</span>}
    >
      <div
        role="toolbar"
        aria-label={BAR_COPY.label}
        data-review-action-bar=""
        className="flex flex-wrap items-center gap-2"
      >
        {retry}
        {[...plan.items].reverse().map((item) => render({ item }))}
      </div>
    </FormActions>
  );
};
