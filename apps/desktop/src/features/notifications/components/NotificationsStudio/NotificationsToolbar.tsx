import { CheckCheck, Trash2 } from 'lucide-react';
import { Button, ConfirmPopover } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly unreadCount: number;
  readonly totalCount: number;
  readonly workspaceName: string | null;
  readonly onMarkAllRead: () => void;
  readonly onDeleteAll: () => Promise<void>;
};

export const NotificationsToolbar = ({
  unreadCount,
  totalCount,
  workspaceName,
  onMarkAllRead,
  onDeleteAll,
}: Props) => {
  const place = workspaceName === null ? 'in every workspace' : `in ${workspaceName}`;
  return (
    <>
      {unreadCount > 0 && (
        <Button variant="ghost" size="sm" onClick={onMarkAllRead}>
          <CheckCheck size={ICON_SIZE.row} aria-hidden />
          Mark all read
        </Button>
      )}
      <ConfirmPopover
        role="danger"
        icon={<Trash2 size={ICON_SIZE.row} aria-hidden />}
        title={`Delete ${totalCount} ${totalCount === 1 ? 'notification' : 'notifications'}?`}
        description={`Clears the log ${place}, read and unread. This can't be undone.`}
        confirmLabel={`Delete ${totalCount}`}
        onConfirm={onDeleteAll}
        trigger={({ isArmed, arm }) => (
          <Button
            variant="ghost-danger"
            size="sm"
            aria-expanded={isArmed}
            aria-haspopup="dialog"
            onClick={arm}
          >
            <Trash2 size={ICON_SIZE.row} aria-hidden />
            Delete all
          </Button>
        )}
      />
    </>
  );
};
