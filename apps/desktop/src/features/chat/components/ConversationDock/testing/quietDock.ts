import type { ConversationDockSlots } from '../conversationDockSlots';

export const QUIET_DOCK: ConversationDockSlots = {
  lead: null,
  hasAsks: false,
  live: { phrase: 'Thinking', startedAt: null, waitingFor: null, stepAgentId: null },
  stop: null,
  stopLabel: null,
  liveSentence: null,
  failure: null,
};
