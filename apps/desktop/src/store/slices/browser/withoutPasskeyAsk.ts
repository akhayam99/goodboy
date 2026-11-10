import type { SessionId } from '@goodboy/types';
import type { BrowserState } from './state';

type Params = {
  readonly asks: BrowserState['browserPasskeyAsks'];
  readonly sessionId: SessionId;
  readonly liveId: string | undefined;
};

export const withoutPasskeyAsk = ({ asks, sessionId, liveId }: Params): Params['asks'] => {
  const told = asks[sessionId];
  if (liveId === undefined || told?.[liveId] === undefined) {
    return asks;
  }
  const rest = Object.fromEntries(Object.entries(told).filter(([id]) => id !== liveId));
  return { ...asks, [sessionId]: rest };
};
