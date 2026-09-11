import type { MountId, MountPullRequestProvider, SessionId } from '@goodboy/types';
import type { ReviewTargetOutcome } from '../review-navigation';
import type { SessionStudio } from '../session-view/types';
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
      await get()
        .setSessionActiveMount({ sessionId, mountId })
        .catch(() => undefined);
      get().setSessionStudio(sessionId, studioFor({ mountId, provider }));
      return { kind: 'opened' };
    }
    return get().openReviewTarget({
      sessionId,
      mountId,
      ...(requestNumber === undefined
        ? { mode: 'create_pr' as const }
        : { prNumber: requestNumber }),
      ...(threadId === undefined ? {} : { threadId }),
    });
  };
};
