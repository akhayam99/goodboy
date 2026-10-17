import { MessageSquare } from 'lucide-react';
import { DrawerFrame } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useNow } from '../../../../shared/hooks/useNow';
import { formatAge } from '../../../../shared/utils/time/formatAge';
import { joinFacts } from '../../../../shared/utils/joinFacts';
import type { ResolvedAction } from '../../../actions/types';
import { ThreadHunk } from '../../../branch/components/ThreadHunk';
import { ThreadProperties } from '../../../branch/components/ThreadProperties';
import type { ReviewCommentBinding } from '../../hooks/useReviewCommentController';
import { BAR_COPY } from '../../commentStateCopy';
import { REVIEW_FLOW_LABEL } from '../../reviewFlowCopy';
import { NoteThreadActions } from '../ReviewFlow/NoteThreadActions';
import { ReviewComment } from '../ReviewFlow/ReviewComment';
import { ThreadOverflowMenu } from '../ReviewFlow/ThreadOverflowMenu';
import type { ReviewPush } from '../ReviewFlow/useReviewPush';
import type { ReviewEntry } from '../ReviewFlow/useReviewEntries';
import { CommentDrawerActions } from './CommentDrawerActions';
import { REVIEW_COMMENT_DRAWER_COPY } from './reviewCommentDrawerCopy';
import { useCommentDrawerPlan } from './useCommentDrawerPlan';

type CommentDrawerPosition = {
  readonly index: number;
  readonly total: number;
};

type Props = {
  readonly sessionId: SessionId;
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

type TitleParams = {
  readonly entry: ReviewEntry;
};

const titleOf = ({ entry }: TitleParams): string => {
  const note = entry.row.reviewerNote;
  if (note === null) {
    return REVIEW_COMMENT_DRAWER_COPY.fallbackTitle;
  }
  if (note.path === null) {
    return note.author;
  }
  const name = note.path.split('/').pop() ?? note.path;
  return note.line == null ? name : `${name}:${note.line}`;
};

export const CommentDrawerFrame = ({
  sessionId,
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
  const now = useNow(60_000);
  const plan = useCommentDrawerPlan({ sessionId, entry, push, hasRunLine });
  const lone = loneOf({ rare: plan.rare });
  const note = entry.row.reviewerNote;
  const isNote = entry.row.thread.originKind === 'diff_comment';
  const meta = joinFacts({
    facts: [
      note?.path === null ? null : note?.author,
      note === null ? null : formatAge({ from: note.createdAtMs, now }),
      entry.word,
      entry.row.commentThread?.head.outdated === true && REVIEW_FLOW_LABEL.lineMoved,
    ],
  });
  const menu =
    plan.rare.length === 0 || lone !== null ? undefined : (
      <ThreadOverflowMenu target={plan.target} label={BAR_COPY.more} omit={plan.shown} />
    );
  return (
    <DrawerFrame
      title={titleOf({ entry })}
      icon={MessageSquare}
      count={position === null ? undefined : REVIEW_COMMENT_DRAWER_COPY.position(position)}
      meta={meta}
      menu={menu}
      onClose={onClose}
    >
      <div
        key={entry.threadId}
        data-review-drawer={entry.threadId}
        className="flex min-w-0 flex-col gap-4"
      >
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
