import {
  describePrWriteInFlight,
  type PrLifecycleAction,
} from '../../../features/review/prLifecycle';
import type { PrWriteTarget } from '../pr-writes/types';
import type { GetFn } from './types';

type Params = PrWriteTarget & {
  readonly get: GetFn;
  readonly action: PrLifecycleAction;
  readonly run: () => Promise<void>;
};

export const withPrWriteClaim = async ({
  get,
  projectId,
  prNumber,
  action,
  run,
}: Params): Promise<void> => {
  const claimed = get().claimPrWrite({ projectId, prNumber, action });
  if (!claimed.ok) {
    throw new Error(describePrWriteInFlight({ action: claimed.claim.action, prNumber }));
  }
  try {
    await run();
  } finally {
    get().releasePrWrite({ projectId, prNumber });
  }
};
