import { Button } from '@goodboy/ui';
import type { MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { openFixComments } from '../../../store/slices/resolve/openFixComments';
import { FIX_COMMENTS_LABEL } from './FixCommentsDrawer/fixCommentsCopy';
import { useReviewEntries } from './ReviewFlow/useReviewEntries';

type Props = {
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
  readonly focusThreadId?: string | null;
};

export const FixCommentsButton = ({ sessionId, mountId, focusThreadId = null }: Props) => {
  const openDrawer = useAppStore((s) => s.openDrawer);
  const { all } = useReviewEntries({ sessionId, scope: 'all' });
  const count = all.filter((entry) => entry.isFixable).length;
  if (count === 0) {
    return null;
  }
  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={() => openFixComments({ openDrawer, sessionId, mountId, focusThreadId })}
    >
      {FIX_COMMENTS_LABEL.title} {count}
    </Button>
  );
};
