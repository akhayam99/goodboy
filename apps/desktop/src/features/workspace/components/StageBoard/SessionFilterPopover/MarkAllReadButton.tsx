import { Button } from '@goodboy/ui';
import type { Session, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { usePendingAction } from '../../../../../shared/hooks/usePendingAction';
import { useUnreadSessionIds } from '../../../../../shared/hooks/useUnreadSessionIds';

const MARK_READ_KEY = 'mark-all-read';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly sessions: ReadonlyArray<Session>;
};

export const MarkAllReadButton = ({ workspaceId, sessions }: Props) => {
  const markSessionsRead = useAppStore((state) => state.markSessionsRead);
  const { pendingKeys, run } = usePendingAction({ workspaceId });
  const unreadIds = useUnreadSessionIds({ sessions });
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={unreadIds.length === 0}
      isBusy={pendingKeys.has(MARK_READ_KEY)}
      onClick={() =>
        void run({
          key: MARK_READ_KEY,
          failureTitle: "Couldn't mark the sessions as read",
          task: () => markSessionsRead({ sessionIds: unreadIds }),
        })
      }
    >
      Mark all as read
    </Button>
  );
};
