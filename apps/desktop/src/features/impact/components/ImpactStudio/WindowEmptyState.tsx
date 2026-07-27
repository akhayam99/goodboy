import { CalendarOff } from 'lucide-react';
import { EmptyState } from '@goodboy/ui';

type Props = {
  readonly what: string;
};

export const WindowEmptyState = ({ what }: Props) => (
  <EmptyState
    icon={CalendarOff}
    title={`No ${what} in the last 30 days`}
    description="Switch to all time to see the full history for this workspace."
    bordered
  />
);
