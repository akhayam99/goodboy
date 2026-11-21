import type { WatchFact } from './watchFacts';

type Params = {
  readonly fact: WatchFact;
};

export const factKeyOf = ({ fact }: Params): string => `${fact.sessionId}|${fact.mountId}`;
