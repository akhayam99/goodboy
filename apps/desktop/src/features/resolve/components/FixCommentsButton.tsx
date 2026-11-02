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
  readonly onApply?: (() => void) | null;
};

export const FixCommentsButton = ({
  sessionId,
  mountId,
  focusThreadId = null,
  fixingThreads = 0,
  waitingFixes = 0,
  onApply = null,
}: Props) => {
  const openDrawer = useAppStore((s) => s.openDrawer);
  const { all } = useReviewEntries({ sessionId, scope: 'all' });
  const { fixable } = commentsCountOf({ threads: all.map((entry) => entry.row.thread) });
  const primary = headerPrimaryOf({
    fixingThreads,
    waitingFixes: onApply === null ? 0 : waitingFixes,
    fixableThreads: fixable,
    unpushedCommits: 0,
    hasOpenThreads: true,
  });
  if (primary === null) {
    return null;
  }
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={primary.isDisabled}
      onClick={() =>
        primary.kind === 'apply'
          ? onApply?.()
          : openFixComments({ openDrawer, sessionId, mountId, focusThreadId })
      }
    >
      {primary.label}
    </Button>
  );
};
