import { CheckCheck } from 'lucide-react';
import { Button } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { ObjectActionVerb } from '../../../actions/ObjectActionVerb';
import type { NotificationsFacts } from '../../../actions/kinds/notifications';

type Props = {
  readonly unreadCount: number;
  readonly onMarkAllRead: () => void;
  readonly deleteAll: NotificationsFacts;
};

export const NotificationsToolbar = ({ unreadCount, onMarkAllRead, deleteAll }: Props) => (
  <>
    {unreadCount > 0 ? (
      <Button variant="ghost" size="sm" onClick={onMarkAllRead}>
        <CheckCheck size={ICON_SIZE.row} aria-hidden />
        Mark all read
      </Button>
    ) : null}
    <ObjectActionVerb
      target={{ kind: 'notifications', facts: deleteAll }}
      actionId="notifications.deleteAll"
    />
  </>
);
