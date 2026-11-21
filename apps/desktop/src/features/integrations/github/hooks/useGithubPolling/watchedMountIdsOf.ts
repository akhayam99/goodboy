import type { MountId, SessionId } from '@goodboy/types';
import type { WatchFact } from './watchFacts';

type Params = {
  readonly facts: ReadonlyArray<WatchFact>;
  readonly sessionId: SessionId;
};

export const watchedMountIdsOf = ({ facts, sessionId }: Params): ReadonlyArray<MountId> =>
  facts.filter((fact) => fact.sessionId === sessionId).map((fact) => fact.mountId);
