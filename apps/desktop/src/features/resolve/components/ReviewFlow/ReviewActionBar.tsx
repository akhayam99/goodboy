import { useMemo, type ReactNode } from 'react';
import { ExternalLink } from 'lucide-react';
import { REVIEW_SOURCE_LABEL } from '@goodboy/core';
import { Button, Kbd, Tooltip } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { useActionEnv } from '../../../actions/useActionEnv';
import { useObjectActions } from '../../../actions/useObjectActions';
import type { ResolvedAction } from '../../../actions/types';
import type { ReviewCommentBinding } from '../../hooks/useReviewCommentController';
import { BAR_COPY } from '../../commentStateCopy';
import { reviewBarPlanOf, type BarItem, type BarVariant } from './reviewBarPlan';
import { StopRunButton } from './StopRunButton';
import { ThreadOverflowMenu } from './ThreadOverflowMenu';
import type { ReviewEntry } from './useReviewEntries';

type Props = {
  readonly sessionId: SessionId;
  readonly entry: ReviewEntry;
  readonly binding: Pick<
    ReviewCommentBinding,
    'compose' | 'isEditingReply' | 'pendingActionId' | 'isSubmitting' | 'onRun'
  >;
};

const PUSH_ACTION = 'review.push';
const OPEN_HOST_ACTION = 'reviewComment.openOnGithub';
const TRANSCRIPT_ACTION = 'reviewComment.transcript';
const STOP_ACTION = 'reviewComment.stop';

const VARIANT_OF: Record<BarVariant, 'primary' | 'secondary' | 'ghost'> = {
  primary: 'primary',
  secondary: 'secondary',
  ghost: 'ghost',
};

const idOf = (item: BarItem): string => {
  switch (item.kind) {
    case 'action':
      return item.id;
    case 'retryPush':
      return PUSH_ACTION;
    case 'viewOnHost':
      return OPEN_HOST_ACTION;
    case 'transcript':
      return TRANSCRIPT_ACTION;
    case 'stop':
      return STOP_ACTION;
    default: {
      const exhaustive: never = item;
      return exhaustive;
    }
  }
};

export const ReviewActionBar = ({ sessionId, entry, binding }: Props) => {
  const { threadId, row, state } = entry;
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
  const host = REVIEW_SOURCE_LABEL[row.thread.sourceKind ?? 'github'];
  const plan = useMemo(
    () =>
      reviewBarPlanOf({
        word: entry.resolveWord,
        state,
        hasRemote: entry.remote !== null,
        actions: actions.map((candidate) => ({ id: candidate.id, slot: candidate.slot })),
      }),
    [actions, entry.remote, entry.resolveWord, state],
  );
  const byId = (id: string): ResolvedAction | undefined =>
    actions.find((candidate) => candidate.id === id);
  const push = reviewActions.find((candidate) => candidate.id === PUSH_ACTION);
  const { pendingActionId } = binding;
  const isIdle = binding.compose === null && !binding.isEditingReply;
  const isBusy = pendingActionId !== null || binding.isSubmitting;
  const items = plan.filter((item) => {
    if (item.kind === 'retryPush') {
      return push !== undefined;
    }
    if (item.kind === 'viewOnHost') {
      return byId(OPEN_HOST_ACTION) !== undefined;
    }
    if (item.kind === 'transcript') {
      return byId(TRANSCRIPT_ACTION) !== undefined;
    }
    if (item.kind === 'stop') {
      return byId(STOP_ACTION) !== undefined;
    }
    return true;
  });
  if (!isIdle || (items.length === 0 && actions.length === 0)) {
    return null;
  }
  const shown = items.map((item) => idOf(item));

  const verbButton = ({
    action,
    variant,
    label = action.label,
    icon = null,
    onClick,
  }: {
    readonly action: ResolvedAction;
    readonly variant: BarVariant;
    readonly label?: string;
    readonly icon?: ReactNode;
    readonly onClick: () => void;
  }): ReactNode => {
    const button = (
      <Button
        key={action.id}
        size="sm"
        variant={VARIANT_OF[variant]}
        data-review-verb={action.id}
        disabled={
          action.blockedReason !== null ||
          (pendingActionId !== null && pendingActionId !== action.id)
        }
        isBusy={pendingActionId === action.id}
        onClick={onClick}
      >
        {icon}
        {label}
        {action.shortcut !== null && (
          <Kbd look="inline" onTone={variant === 'primary'} aria-hidden>
            {shortcutGlyphs(action.shortcut)}
          </Kbd>
        )}
      </Button>
    );
    return action.blockedReason === null ? (
      button
    ) : (
      <Tooltip key={action.id} content={action.blockedReason} anchorClassName="inline-flex">
        {button}
      </Tooltip>
    );
  };

  const render = (item: BarItem): ReactNode => {
    switch (item.kind) {
      case 'action': {
        const action = byId(item.id);
        if (action === undefined) {
          return null;
        }
        return verbButton({
          action,
          variant: item.variant,
          onClick: () => binding.onRun(action.id),
        });
      }
      case 'retryPush':
        return (
          <Button
            key="retryPush"
            size="sm"
            variant="primary"
            data-review-verb={PUSH_ACTION}
            disabled={push === undefined || push.blockedReason !== null || isBusy}
            onClick={() => void runReview({ actionId: PUSH_ACTION })}
          >
            {BAR_COPY.retryPush}
          </Button>
        );
      case 'viewOnHost':
        return (
          <Button
            key="viewOnHost"
            size="sm"
            variant="secondary"
            data-review-verb={OPEN_HOST_ACTION}
            onClick={() => binding.onRun(OPEN_HOST_ACTION)}
          >
            <ExternalLink size={ICON_SIZE.control} aria-hidden />
            {BAR_COPY.viewOn({ host })}
          </Button>
        );
      case 'transcript':
        return (
          <Button
            key="transcript"
            size="sm"
            variant="secondary"
            data-review-verb={TRANSCRIPT_ACTION}
            onClick={() => binding.onRun(TRANSCRIPT_ACTION)}
          >
            {BAR_COPY.openTranscript}
          </Button>
        );
      case 'stop':
        return <StopRunButton key="stop" onStop={() => binding.onRun(STOP_ACTION)} />;
      default: {
        const exhaustive: never = item;
        return exhaustive;
      }
    }
  };

  return (
    <div
      role="toolbar"
      aria-label={BAR_COPY.label}
      data-review-action-bar
      className="flex h-12 min-w-0 shrink-0 items-center gap-2 border-t border-border-soft bg-background"
    >
      {items.map((item) => render(item))}
      <span className="ml-auto flex shrink-0 items-center">
        <ThreadOverflowMenu target={target} label={BAR_COPY.more} omit={shown} />
      </span>
    </div>
  );
};
