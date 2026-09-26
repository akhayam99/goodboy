import { addProjectSentryLink } from '@goodboy/db';
import type { IsoDateTime } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, LinkSentryProjectParams } from './types';

export const linkSentryProject =
  (get: GetFn) =>
  async (params: LinkSentryProjectParams): Promise<void> => {
    await addProjectSentryLink({
      db: tauriDatabase,
      link: {
        id: crypto.randomUUID(),
        ...params,
        createdAt: new Date().toISOString() as IsoDateTime,
      },
    });
    await get().loadProjectSentryLinks({ workspaceId: params.workspaceId });
  };
