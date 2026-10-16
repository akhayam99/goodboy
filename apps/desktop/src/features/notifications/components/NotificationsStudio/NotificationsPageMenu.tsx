import { useState } from 'react';
import { CheckCheck, Trash2 } from 'lucide-react';
import { ConfirmPopover, OverflowMenu, type OverflowMenuItem } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly unreadCount: number;
  readonly onMarkAllRead: () => void;
  readonly totalCount: number;
  readonly workspaceName: string | null;
  readonly onDeleteAll: () => Promise<void>;
};

export const NotificationsPageMenu = ({
  unreadCount,
  onMarkAllRead,
  totalCount,
  workspaceName,
  onDeleteAll,
}: Props) => {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const place = workspaceName === null ? 'in every workspace' : `in ${workspaceName}`;
  const items: ReadonlyArray<OverflowMenuItem> = [
    {
      kind: 'item',
      key: 'mark-all-read',
      label: 'Mark all read',
      icon: CheckCheck,
      disabled: unreadCount === 0,
      onClick: onMarkAllRead,
    },
    {
      kind: 'item',
      key: 'delete-all',
      label: 'Delete all…',
      icon: Trash2,
      destructive: true,
      onClick: () => setIsConfirmOpen(true),
    },
  ];
  return (
    <ConfirmPopover
      role="danger"
      icon={<Trash2 size={ICON_SIZE.row} aria-hidden />}
      title={`Delete ${totalCount} ${totalCount === 1 ? 'notification' : 'notifications'}?`}
      description={`Clears the log ${place}, read and unread. This can't be undone.`}
      confirmLabel={`Delete ${totalCount}`}
      isOpen={isConfirmOpen}
      onCancel={() => setIsConfirmOpen(false)}
      onConfirm={async () => {
        await onDeleteAll();
        setIsConfirmOpen(false);
      }}
      trigger={() => (
        <OverflowMenu items={items} label="More notification actions" size="control" />
      )}
    />
  );
};
