import { READ_FAILED } from '../../slices/notifications/errorRecovery';
import type { SessionId } from '@goodboy/types';
import type { GetFn, SetFn } from '../../slice-types';
import { refreshSessionArtifactsAndPlans } from '../../slices/artifacts/refresh';

type Params = {
  readonly get: GetFn;
  readonly set: SetFn;
  readonly sessionId: SessionId;
};

export const reloadSessionArtifacts = async ({ get, set, sessionId }: Params): Promise<void> => {
  try {
    await refreshSessionArtifactsAndPlans(set, sessionId);
  } catch (error) {
    await get().reportError({
      recovery: READ_FAILED,
      title: "Couldn't refresh the plans",
      error,
      sessionId,
    });
  }
};
