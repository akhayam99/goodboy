import { MessageSquare } from 'lucide-react';
import { DrawerFrame } from '@goodboy/ui';
import type { MountId, SessionId } from '@goodboy/types';
import type { ResolvedAction } from '../../../actions/types';
import { ThreadHunk } from '../../../branch/components/ThreadHunk';
import { ThreadProperties } from '../../../branch/components/ThreadProperties';
import type { ReviewCommentBinding } from '../../hooks/useReviewCommentController';
import { BAR_COPY } from '../../commentStateCopy';
import { NoteThreadActions } from '../ReviewFlow/NoteThreadActions';
import { ReviewComment } from '../ReviewFlow/ReviewComment';
import { ThreadOverflowMenu } from '../ReviewFlow/ThreadOverflowMenu';
import { drawerMenuOmitOf } from './drawerMenuOmitOf';
import type { ReviewPush } from '../ReviewFlow/useReviewPush';
import type { ReviewEntry } from '../ReviewFlow/useReviewEntries';
import { CommentDrawerActions } from './CommentDrawerActions';
import { CommentDrawerAuthor } from './CommentDrawerAuthor';
import { SessionMediaScope } from '../../../../shared/components/SessionMediaScope';
import { REVIEW_COMMENT_DRAWER_COPY } from './reviewCommentDrawerCopy';
import { useCommentDrawerPlan } from './useCommentDrawerPlan';

type CommentDrawerPosition = {
  readonly index: number;
  readonly total: number;
};

type Props = {
  readonly sessionId: SessionId;
  readonly mountId?: MountId | null;
  readonly entry: ReviewEntry;
  readonly entries: ReadonlyArray<ReviewEntry>;
  readonly push: ReviewPush;
  readonly position: CommentDrawerPosition | null;
  readonly hasRunLine: boolean;
  readonly binding: ReviewCommentBinding;
  readonly onClose: () => void;
  readonly onSelect: (threadId: string) => void;
  readonly onTryAgain: () => void;
  readonly onStartOver: () => void;
};

type LoneParams = {
  readonly rare: ReadonlyArray<ResolvedAction>;
};

const loneOf = ({ rare }: LoneParams): ResolvedAction | null => {
  const [only] = rare;
  if (only === undefined || rare.length > 1) {
    return null;
  }
  const hasChoices = only.choices !== null && only.choices.length > 0;
  return only.confirm === null && !hasChoices ? only : null;
};

export const CommentDrawerFrame = ({
  sessionId,
  mountId = null,
  entry,
  entries,
  push,
  position,
  hasRunLine,
  binding,
  onClose,
  onSelect,
  onTryAgain,
  onStartOver,
}: Props) => {
  const plan = useCommentDrawerPlan({ sessionId, entry, push, hasRunLine });
  const lone = loneOf({ rare: plan.rare });
  const isNote = entry.row.thread.originKind === 'diff_comment';
  const menu =
    plan.rare.length === 0 || lone !== null ? undefined : (
      <ThreadOverflowMenu
        target={plan.target}
        label={BAR_COPY.more}
        omit={drawerMenuOmitOf({ shown: plan.shown, rare: plan.rare })}
      />
    );
  return (
    <DrawerFrame
      title={REVIEW_COMMENT_DRAWER_COPY.title}
      icon={MessageSquare}
      count={position === null ? undefined : REVIEW_COMMENT_DRAWER_COPY.position(position)}
      menu={menu}
      onClose={onClose}
    >
      <div
        key={entry.threadId}
        data-review-drawer={entry.threadId}
        className="flex min-w-0 flex-col gap-4"
      >
        <CommentDrawerAuthor entry={entry} />
        <SessionMediaScope sessionId={sessionId} mountId={mountId}>
          <ReviewComment
            sessionId={sessionId}
            entry={entry}
            entries={entries}
            hunk={
              <ThreadHunk
                row={entry.row}
                onOpenInDiff={() => binding.onRun('reviewComment.openInDiff')}
              />
            }
            {...binding}
            onSelect={onSelect}
            onTryAgain={onTryAgain}
            onStartOver={onStartOver}
          />
        </SessionMediaScope>
        <ThreadProperties sessionId={sessionId} entry={entry} />
        <CommentDrawerActions
          entry={entry}
          push={push}
          plan={plan}
          lone={lone}
          extra={isNote ? <NoteThreadActions sessionId={sessionId} entry={entry} /> : null}
          binding={binding}
        />
      </div>
    </DrawerFrame>
  );
};
