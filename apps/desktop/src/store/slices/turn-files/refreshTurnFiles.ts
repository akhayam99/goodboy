import type { SessionId } from '@goodboy/types';
import { READ_FAILED } from '../notifications/errorRecovery';
import type { SliceDeps } from '../../slice-types';

type Params = {
  readonly sessionId: SessionId;
};

export const refreshTurnFiles = ({ get }: SliceDeps) => {
  const refresh = async ({ sessionId }: Params): Promise<boolean> => {
    try {
      await get().loadTurnFiles({ sessionId });
      return true;
    } catch (error) {
      await get().reportError({
        title: "Couldn't read what the turns changed",
        error,
        recovery: READ_FAILED,
        sessionId,
        coalesceKey: `turn-files:${sessionId}`,
        retry: () => refresh({ sessionId }),
      });
      return false;
    }
  };
  return refresh;
};
