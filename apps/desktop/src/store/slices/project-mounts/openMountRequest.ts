import type { MountId, MountPullRequestProvider, SessionId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import type { ReviewTargetOutcome } from '../review-navigation';
import type { SessionStudio } from '../session-view/types';
import { branchPlace, sessionPlace } from '../navigation/place';
import { selectMountById } from './selectors';
import type { GetFn, SetFn } from './types';

export type OpenMountRequestInput = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly provider: MountPullRequestProvider;
  readonly requestNumber?: number;
  readonly threadId?: string;
};

type StudioParams = {
  readonly mountId: MountId;
  readonly provider: Exclude<MountPullRequestProvider, 'github'>;
};

const studioFor = ({ mountId, provider }: StudioParams): SessionStudio =>
  provider === 'gitlab' ? { kind: 'mr', mountId } : { kind: 'bitbucket', mountId };

export const openMountRequest = (_set: SetFn, get: GetFn) => {
  return async ({
    sessionId,
    mountId,
    provider,
    requestNumber,
    threadId,
  }: OpenMountRequestInput): Promise<ReviewTargetOutcome> => {
    if (provider !== 'github') {
      try {
        await get().setSessionActiveMount({ sessionId, mountId });
      } catch (error) {
        return { kind: 'failed', error: formatError(error) };
      }
      get().navigate({ to: sessionPlace({ sessionId, studio: studioFor({ mountId, provider }) }) });
      return { kind: 'opened' };
    }
    if (requestNumber === undefined) {
      try {
        await get().setSessionActiveMount({ sessionId, mountId });
      } catch (error) {
        return { kind: 'failed', error: formatError(error) };
      }
      get().setPullRequestMode({ sessionId, mode: 'create_pr' });
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
