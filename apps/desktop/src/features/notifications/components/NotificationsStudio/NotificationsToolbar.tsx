import { CheckCheck } from 'lucide-react';
import { Button } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly unreadCount: number;
  readonly onMarkAllRead: () => void;
};

export const NotificationsToolbar = ({ unreadCount, onMarkAllRead }: Props) =>
  unreadCount > 0 ? (
    <Button variant="ghost" size="sm" onClick={onMarkAllRead}>
      <CheckCheck size={ICON_SIZE.row} aria-hidden />
      Mark all read
    </Button>
  ) : null;
