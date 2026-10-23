import type { SliceDeps } from '../../slice-types';
import type { BringOriginInput, BringOriginOutcome } from './bringOriginIntoHistory';

export const bringOriginInAndPush =
  ({ get }: SliceDeps) =>
  async ({
    sessionId,
    mountId,
    canStartRewriter = true,
  }: BringOriginInput): Promise<BringOriginOutcome> => {
    get().adoptRebaseStop({ sessionId, mountId });
    const outcome = await get().bringOriginIntoHistory({
      sessionId,
      mountId,
      canStartRewriter,
    });
    if (outcome !== 'applied') {
      return outcome;
    }
    const run = get().historyRuns[mountId];
    if (run === undefined || run.phase !== 'applied') {
      return 'stopped';
    }
    return get().pushHistoryRewrite({
      sessionId,
      mountId,
      origin: run.origin,
      planId: run.planId,
      expectedRemoteSha: run.remoteSha,
      identity: run.identity,
    });
  };
