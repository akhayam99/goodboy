import { Button } from '@goodboy/ui';
import type { MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { openFixComments } from '../../../store/slices/resolve/openFixComments';
import { commentsCountOf } from '../commentsCountOf';
import { useReviewEntries } from './ReviewFlow/useReviewEntries';

type Props = {
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
  readonly focusThreadId?: string | null;
};

export const FixCommentsButton = ({ sessionId, mountId, focusThreadId = null }: Props) => {
  const openDrawer = useAppStore((s) => s.openDrawer);
  const { all } = useReviewEntries({ sessionId, scope: 'all' });
  const count = commentsCountOf({ threads: all.map((entry) => entry.row.thread) }).fixable;
  if (count === 0) {
    return null;
  }
  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={() => openFixComments({ openDrawer, sessionId, mountId, focusThreadId })}
    >
      {`Fix ${count} ${count === 1 ? 'comment' : 'comments'}`}
    </Button>
  );
};
