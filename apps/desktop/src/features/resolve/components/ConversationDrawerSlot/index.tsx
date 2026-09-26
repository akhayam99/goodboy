import { setConversationSlot } from './slotNode';

export const ConversationDrawerSlot = () => (
  <div
    ref={setConversationSlot}
    data-conversation-slot=""
    className="flex min-h-0 min-w-0 flex-1 flex-col"
  />
);
