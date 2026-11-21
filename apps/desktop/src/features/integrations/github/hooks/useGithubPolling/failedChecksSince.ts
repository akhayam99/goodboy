import { factKeyOf } from './factKeyOf';
import type { WatchFact } from './watchFacts';

type Params = {
  readonly previous: ReadonlyMap<string, WatchFact>;
  readonly next: ReadonlyArray<WatchFact>;
};

export const failedChecksSince = ({ previous, next }: Params): ReadonlyArray<WatchFact> =>
  next.filter((fact) => {
    const before = previous.get(factKeyOf({ fact }));
    return (
      before !== undefined &&
      before.prNumber === fact.prNumber &&
      before.headSha === fact.headSha &&
      before.checks === 'pending' &&
      fact.checks === 'failure'
    );
  });
