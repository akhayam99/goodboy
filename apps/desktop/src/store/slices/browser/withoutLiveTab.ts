import type { SessionId } from '@goodboy/types';
import type { BrowserState } from './state';

type Params = {
  readonly live: BrowserState['browserLiveTabs'];
  readonly sessionId: SessionId;
  readonly tabId: string;
};

export const withoutLiveTab = ({ live, sessionId, tabId }: Params): Params['live'] => {
  const bound = live[sessionId];
  if (bound?.[tabId] === undefined) {
    return live;
  }
  const rest = Object.fromEntries(Object.entries(bound).filter(([id]) => id !== tabId));
  return { ...live, [sessionId]: rest };
};
