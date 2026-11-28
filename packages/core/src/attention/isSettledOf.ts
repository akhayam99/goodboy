import { isEveryRequestSettled } from './isEveryRequestSettled';
import { settledAtOf } from './settledAtOf';
import type { SettleParams } from './settleTypes';

type Params = SettleParams & {
  readonly agentStartedAts: ReadonlyArray<number>;
};

export const isSettledOf = ({ requests, threads, agentStartedAts }: Params): boolean => {
  if (!isEveryRequestSettled({ requests, threads })) {
    return false;
  }
  const settledAt = settledAtOf({ requests, threads });
  return settledAt === null || !agentStartedAts.some((startedAt) => startedAt > settledAt);
};
