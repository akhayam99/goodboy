import type { MountId, MountPullRequestProvider, SessionId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import type { ReviewTargetOutcome } from '../review-navigation';
import { branchPlace } from '../navigation/place';
import { selectMountById } from './selectors';
import type { GetFn, SetFn } from './types';

export type OpenMountRequestInput = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly provider: MountPullRequestProvider;
  readonly requestNumber?: number;
  readonly threadId?: string;
};

export const openMountRequest = (_set: SetFn, get: GetFn) => {
  return async ({
    sessionId,
    mountId,
    provider,
    requestNumber,
    threadId,
  }: OpenMountRequestInput): Promise<ReviewTargetOutcome> => {
    if (provider !== 'github' || requestNumber === undefined) {
      try {
        await get().setSessionActiveMount({ sessionId, mountId });
      } catch (error) {
        return { kind: 'failed', error: formatError(error) };
      }
      if (provider === 'github') {
        get().setPullRequestMode({ sessionId, mode: 'create_pr' });
      }
      const mountPath = selectMountById({ state: get(), sessionId, mountId })?.worktreePath ?? null;
      get().navigate({ to: branchPlace({ sessionId, mountPath, tab: 'pr' }) });
      return { kind: 'opened' };
    }
    return get().openReviewTarget({
      sessionId,
      destination:
        threadId === undefined
          ? { kind: 'pull_request', mountId, prNumber: requestNumber }
          : { kind: 'thread', mountId, prNumber: requestNumber, threadId },
    });
  };
};
