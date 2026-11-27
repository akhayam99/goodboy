import type { MountPullRequestLink, SessionMountView } from '@goodboy/types';
import { createLatestOnly } from '../../../runtime/state-writes/latestOnly';
import { loadMountViews } from '../mountViews';
import { loadCanonicalLinks } from './loadCanonicalLinks';
import type { SliceDeps } from '../../../slice-types';
import type { SessionKeyInput } from '../types';

type WorkRecord = {
  readonly views: ReadonlyArray<SessionMountView>;
  readonly links: ReadonlyArray<MountPullRequestLink>;
};

export const loadSessionWorkRecord = ({ set, get }: SliceDeps) => {
  const latest = createLatestOnly();
  return async ({ sessionId }: SessionKeyInput): Promise<void> => {
    await latest.run({
      key: sessionId,
      request: async (): Promise<WorkRecord> => {
        const views = await loadMountViews({ get, sessionId });
        return { views, links: await loadCanonicalLinks({ sessionId, views }) };
      },
      apply: ({ views, links }) => {
        set((state) => ({
          sessionMounts: { ...state.sessionMounts, [sessionId]: views },
          mountPrLinks: {
            ...state.mountPrLinks,
            ...Object.fromEntries(links.map((link) => [link.mountId, link])),
          },
        }));
      },
    });
  };
};
