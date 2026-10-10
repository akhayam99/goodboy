import type { ProviderId } from '@goodboy/types';
import { applyProviderHealthAction } from './applyProviderHealthAction';
import type { RunOutcome } from './providerHealth';
import type { GetFn, SetFn } from './types';

const REFUSED_RUN_CAP = 200;

const refusedRunIds = new Set<string>();

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly providerId: ProviderId;
  readonly runId: string;
  readonly outcome: RunOutcome;
  readonly message?: string;
};

export const recordProviderRun = ({
  set,
  get,
  providerId,
  runId,
  outcome,
  message,
}: Params): void => {
  if (outcome === 'refused') {
    if (refusedRunIds.has(runId)) {
      return;
    }
    refusedRunIds.add(runId);
    if (refusedRunIds.size > REFUSED_RUN_CAP) {
      const [oldest] = refusedRunIds;
      if (oldest !== undefined) {
        refusedRunIds.delete(oldest);
      }
    }
  }
  applyProviderHealthAction({
    set,
    get,
    providerId,
    action: {
      type: 'run',
      at: Date.now(),
      outcome,
      ...(message !== undefined && { message }),
    },
  });
};
