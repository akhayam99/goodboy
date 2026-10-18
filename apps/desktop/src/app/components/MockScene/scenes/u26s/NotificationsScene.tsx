import { useEffect } from 'react';
import { useAppStore } from '../../../../../store';
import { NotificationsScene as AuditNotificationsScene } from '../audit/NotificationsScene';

type Variant = 'rows' | 'row-menu' | 'header-menu';

type Props = {
  readonly variant: Variant;
};

const OPEN_STUDIO = 'Open all';

const CLICKS: Readonly<Record<Variant, ReadonlyArray<string>>> = {
  rows: [OPEN_STUDIO],
  'row-menu': [OPEN_STUDIO, 'Actions for "Session reached'],
  'header-menu': [OPEN_STUDIO, 'More notification actions'],
};

const NotificationsScene = ({ variant }: Props) => {
  useEffect(() => {
    const { notifications } = useAppStore.getState();
    useAppStore.setState({
      notifications: notifications.map((notification) => ({
        ...notification,
        title: notification.title.replace('of its cap', 'of its limit'),
      })),
    });
  }, []);

  return <AuditNotificationsScene openLabels={CLICKS[variant]} />;
};

export const U26S_NOTIFICATIONS_SCENES = {
  'u26s-notifications-rows': () => <NotificationsScene variant="rows" />,
  'u26s-notifications-row-menu': () => <NotificationsScene variant="row-menu" />,
  'u26s-notifications-header-menu': () => <NotificationsScene variant="header-menu" />,
};
