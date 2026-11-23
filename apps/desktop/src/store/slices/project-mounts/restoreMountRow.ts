import { getSessionMount, insertSessionMount, UniqueViolationError } from '@goodboy/db';
import type { SessionMount } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { applyMountViews, loadMountViews } from './mountViews';
import { sessionById } from '../sessions/sessionIndex';
import type { SliceDeps } from '../../slice-types';

type RestoreMountRowInput = {
  readonly mount: SessionMount;
};

export const restoreMountRow = ({ set, get }: SliceDeps) => {
  return async ({ mount }: RestoreMountRowInput): Promise<boolean> => {
    const sessionId = mount.sessionId;
    if (sessionById(get().sessions, sessionId) === undefined) {
      return false;
    }
    const current = await getSessionMount({ db: tauriDatabase, sessionId, mountId: mount.id });
    if (current === null) {
      try {
        await insertSessionMount({ db: tauriDatabase, mount });
      } catch (error) {
        if (error instanceof UniqueViolationError) {
          return false;
        }
        throw error;
      }
    }
    applyMountViews({ set, sessionId, views: await loadMountViews({ get, sessionId }) });
    if (!mount.isAttached) {
      await get().checkMountBranchGone({ sessionId, mountId: mount.id });
    }
    return true;
  };
};
