import { registerAskBackend } from '../features/session/ask/activeAskBackend';
import type { AskBackend } from '../features/session/ask/askBackend';
import type { ChatBackend } from '../features/workspace-chat/chatBackend';
import { registerChatBackend } from '../features/workspace-chat/activeChatBackend';
import { registerMockFixtures, type MockFixtureReaders } from '../shared/lib/mockFixtures';

type Params = {
  readonly ask: AskBackend;
  readonly chat: ChatBackend;
  readonly fixtures: MockFixtureReaders;
};

export const installBackends = ({ ask, chat, fixtures }: Params): void => {
  registerChatBackend({ backend: chat });
  registerAskBackend({ backend: ask });
  registerMockFixtures({ readers: fixtures });
};
