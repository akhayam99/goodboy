import { Inbox, MessageCircle, Plug, SquareKanban, TrendingUp, Waypoints } from './generated/icons';

export const SESSION_DOORS = [
  { label: 'Board', Icon: SquareKanban, isCurrent: true },
  { label: 'Tasks', Icon: Inbox, isCurrent: false },
  { label: 'Workflows', Icon: Waypoints, isCurrent: false },
  { label: 'Chat', Icon: MessageCircle, isCurrent: false },
  { label: 'Connect', Icon: Plug, isCurrent: false },
  { label: 'Impact', Icon: TrendingUp, isCurrent: false },
] as const;
