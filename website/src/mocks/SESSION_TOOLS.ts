import { Activity, Globe, ListVideo, MessageSquareText, SquareTerminal } from './generated/icons';

export const SESSION_TOOLS = [
  { label: 'Terminal', Icon: SquareTerminal },
  { label: 'Browser', Icon: Globe },
  { label: 'Scripts', Icon: ListVideo },
  { label: 'Ask', Icon: MessageSquareText },
  { label: 'Monitor', Icon: Activity },
] as const;
