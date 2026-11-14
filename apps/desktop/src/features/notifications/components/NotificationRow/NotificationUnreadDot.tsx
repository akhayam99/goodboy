import { StatusDot } from '@goodboy/ui';

type Props = {
  readonly isDebt: boolean;
};

export const NotificationUnreadDot = ({ isDebt }: Props) => (
  <span
    data-unread-dot={isDebt ? 'warning' : 'primary'}
    role="img"
    aria-label="Unread"
    className="flex shrink-0"
  >
    <StatusDot tone={isDebt ? 'warning' : 'primary'} size="sm" />
  </span>
);
