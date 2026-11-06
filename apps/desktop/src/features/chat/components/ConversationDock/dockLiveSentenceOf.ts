import { THINKING_PHRASE, WRITING_PHRASE } from '../../utils/livePhraseOf';
import type { ConversationLive, ConversationStop } from '../../../../shared/types/conversationStop';

type Params = {
  readonly live: ConversationLive;
  readonly stop: ConversationStop;
};

export const dockLiveSentenceOf = ({ live, stop }: Params): string => {
  if (stop.phase === 'stopping') {
    return 'Stopping';
  }
  if (stop.phase === 'stalled') {
    return 'Still stopping';
  }
  if (stop.sentence !== null) {
    return stop.sentence;
  }
  const isWaiting =
    live.waitingFor !== null && (live.phrase === THINKING_PHRASE || live.phrase === WRITING_PHRASE);
  return isWaiting ? `Waiting for ${live.waitingFor}` : live.phrase;
};
