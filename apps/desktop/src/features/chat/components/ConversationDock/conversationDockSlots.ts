import type { ReactNode } from 'react';
import type { ConversationLive, ConversationStop } from '../../../../shared/types/conversationStop';
import type { DockFailure } from './dockFailureOf';

export type ConversationDockSlots = Readonly<{
  lead: ReactNode;
  hasAsks: boolean;
  live: ConversationLive;
  stop: ConversationStop | null;
  stopLabel: string | null;
  liveSentence: string | null;
  failure: DockFailure | null;
}>;
