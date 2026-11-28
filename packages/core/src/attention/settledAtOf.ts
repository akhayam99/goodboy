import { isEveryRequestSettled } from './isEveryRequestSettled';
import type { SettleParams } from './settleTypes';

export const settledAtOf = ({ requests, threads }: SettleParams): number | null => {
  if (!isEveryRequestSettled({ requests, threads })) {
    return null;
  }
  const merges = requests.filter((request) => request.state === 'merged');
  if (merges.length === 0) {
    return null;
  }
  const times = merges.flatMap((request) => (request.mergedAt === null ? [] : [request.mergedAt]));
  return times.length === merges.length ? Math.max(...times) : null;
};
