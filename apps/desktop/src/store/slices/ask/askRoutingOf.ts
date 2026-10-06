import type { SessionId } from '@goodboy/types';
import { defaultChatModel } from '../../../features/workspace-chat/defaultChatModel';
import type { AppStore } from '../../store';
import type { AskRouting } from './state';

type Params = {
  readonly state: AppStore;
  readonly sessionId: SessionId;
};

const ASK_DEFAULT_EFFORT = 'low';

export const askRoutingOf = ({ state, sessionId }: Params): AskRouting => {
  const threadId = state.askThreadId[sessionId] ?? null;
  const thread = (state.askThreads[sessionId] ?? []).find((candidate) => candidate.id === threadId);
  if (thread !== undefined) {
    return { provider: thread.provider, model: thread.model, effort: thread.effort };
  }
  const chosen = state.askRouting[sessionId];
  if (chosen !== undefined) {
    return chosen;
  }
  const connected = state.providers
    .filter((provider) => provider.connection === 'connected')
    .map((provider) => provider.id);
  const choice = defaultChatModel({ connected });
  return { provider: choice.provider, model: choice.model, effort: ASK_DEFAULT_EFFORT };
};
