import { Inbox, MessageCircle, SquareKanban, Waypoints } from './generated/icons';

export const SESSION_DOORS = [
  { label: 'Board', Icon: SquareKanban },
  { label: 'Tasks', Icon: Inbox },
  { label: 'Chat', Icon: MessageCircle },
  { label: 'Workflows', Icon: Waypoints },
] as const;
