import type { SessionId } from '@goodboy/types';
import { saveSessionDockGrid } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { commitAfterConfirm } from '../../runtime/state-writes/commitAfterConfirm';
import type { SliceDeps } from '../../slice-types';
import { dockGridWrites } from './dockGridWrites';

type RememberParams = {
  readonly sessionId: SessionId;
  readonly stored: string;
  readonly savedAt: number;
};

export const rememberDockGrid = ({ get }: Pick<SliceDeps, 'get'>) => {
  return async ({ sessionId, stored, savedAt }: RememberParams): Promise<boolean> => {
    const result = await commitAfterConfirm({
      get,
      failureTitle: "Couldn't save the panels of this session",
      target: { sessionId },
      step: () =>
        dockGridWrites.run({
          key: sessionId,
          task: () => saveSessionDockGrid({ db: tauriDatabase, sessionId, grid: stored, savedAt }),
        }),
      commit: () => undefined,
    });
    return result.isOk;
  };
};
