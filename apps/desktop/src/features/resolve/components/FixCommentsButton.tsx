import { Button } from '@goodboy/ui';
import type { MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { openFixComments } from '../../../store/slices/resolve/openFixComments';
import { useReviewEntries } from './ReviewFlow/useReviewEntries';

type Props = {
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
  readonly focusThreadId?: string | null;
};

const FIX_COMMENTS_TITLE = 'Fix comments';

export const FixCommentsButton = ({ sessionId, mountId, focusThreadId = null }: Props) => {
  const openDrawer = useAppStore((s) => s.openDrawer);
  const { entries } = useReviewEntries({ sessionId, scope: 'branch' });
  const count = entries.filter((entry) => entry.isFixable).length;
  if (count === 0) {
    return null;
  }
  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={() => openFixComments({ openDrawer, sessionId, mountId, focusThreadId })}
    >
      {FIX_COMMENTS_TITLE} {count}
    </Button>
  );
};
