import { listProjectSentryLinks } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { LoadProjectSentryLinksParams, SetFn } from './types';

export const loadProjectSentryLinks =
  (set: SetFn) =>
  async ({ workspaceId }: LoadProjectSentryLinksParams): Promise<void> => {
    const links = await listProjectSentryLinks({ db: tauriDatabase, workspaceId });
    set((state) => ({
      projectSentryLinks: { ...state.projectSentryLinks, [workspaceId]: links },
    }));
  };
