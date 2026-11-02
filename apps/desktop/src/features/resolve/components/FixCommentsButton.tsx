import { Button } from '@goodboy/ui';
import type { MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { openFixComments } from '../../../store/slices/resolve/openFixComments';
import { commentsCountOf } from '../commentsCountOf';
import { headerPrimaryOf } from '../commentsHeader';
import { useReviewEntries } from './ReviewFlow/useReviewEntries';

type Props = {
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
  readonly focusThreadId?: string | null;
  readonly fixingThreads?: number;
  readonly waitingFixes?: number;
  readonly unpushedCommits?: number;
  readonly onApply?: (() => void) | null;
  readonly onPush?: (() => void) | null;
  readonly onRequestReview?: (() => void) | null;
};

export const FixCommentsButton = ({
  sessionId,
  mountId,
  focusThreadId = null,
  fixingThreads = 0,
  waitingFixes = 0,
  unpushedCommits = 0,
  onApply = null,
  onPush = null,
  onRequestReview = null,
}: Props) => {
  const openDrawer = useAppStore((s) => s.openDrawer);
  const { all } = useReviewEntries({ sessionId, scope: 'all' });
  const { fixable, unresolved } = commentsCountOf({
    threads: all.map((entry) => entry.row.thread),
  });
  const primary = headerPrimaryOf({
    fixingThreads,
    waitingFixes: onApply === null ? 0 : waitingFixes,
    fixableThreads: fixable,
    unpushedCommits,
    hasOpenThreads: unresolved > 0 || onRequestReview === null,
  });
  if (primary === null || (primary.kind === 'push' && onPush === null)) {
    return null;
  }
  const onClick = (): void => {
    if (primary.kind === 'apply') {
      onApply?.();
      return;
    }
    if (primary.kind === 'push') {
      onPush?.();
      return;
    }
    if (primary.kind === 'request_review') {
      onRequestReview?.();
      return;
    }
    openFixComments({ openDrawer, sessionId, mountId, focusThreadId });
  };
  return (
    <Button size="sm" variant="secondary" disabled={primary.isDisabled} onClick={onClick}>
      {primary.label}
    </Button>
  );
};
