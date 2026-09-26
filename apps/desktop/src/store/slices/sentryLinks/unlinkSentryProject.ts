import { removeProjectSentryLink } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, UnlinkSentryProjectParams } from './types';

export const unlinkSentryProject =
  (get: GetFn) =>
  async ({ workspaceId, ...link }: UnlinkSentryProjectParams): Promise<void> => {
    await removeProjectSentryLink({ db: tauriDatabase, ...link });
    await get().loadProjectSentryLinks({ workspaceId });
  };
