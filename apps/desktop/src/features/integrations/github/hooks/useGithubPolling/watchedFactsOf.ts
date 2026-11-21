import type { MountId } from '@goodboy/types';
import type { WatchFact } from './watchFacts';

type Params = {
  readonly facts: ReadonlyArray<WatchFact>;
  readonly rerunMountIds: ReadonlySet<MountId>;
};

export const watchedFactsOf = ({ facts, rerunMountIds }: Params): ReadonlyArray<WatchFact> =>
  facts.filter((fact) => fact.checks === 'pending' || rerunMountIds.has(fact.mountId));
