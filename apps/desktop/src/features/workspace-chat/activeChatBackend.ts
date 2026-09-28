import { MOCK_ENABLED } from '../../store/mock-data';
import type { ChatBackend } from './chatBackend';
import { createMemoryChatBackend } from './createMemoryChatBackend';
import { mockChatResponder } from './mockChatResponder';
import { mockChatSeed } from './mockChatSeed';
import { mockWorkSummarizer } from './mockWorkSummarizer';
import { tauriChatBackend } from './tauriChatBackend';

export const activeChatBackend: ChatBackend = MOCK_ENABLED
  ? createMemoryChatBackend({
      respond: mockChatResponder,
      seed: mockChatSeed,
      summarize: mockWorkSummarizer,
    })
  : tauriChatBackend;
