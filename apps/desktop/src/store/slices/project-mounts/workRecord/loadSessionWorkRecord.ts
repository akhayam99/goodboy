import { listMountPullRequestLinks } from '@goodboy/db';
import type { MountPullRequestLink, SessionMountView } from '@goodboy/types';
import { tauriDatabase } from '../../../../shared/lib/db';
import { createLatestOnly } from '../../../runtime/state-writes/latestOnly';
import { loadMountViews } from '../mountViews';
import type { SliceDeps } from '../../../slice-types';
import type { SessionKeyInput } from '../types';

type WorkRecord = {
  readonly views: ReadonlyArray<SessionMountView>;
  readonly links: ReadonlyArray<MountPullRequestLink>;
};

type LinksParams = {
  readonly links: ReadonlyArray<MountPullRequestLink>;
};

const latestLinkOf = ({ links }: LinksParams): ReadonlyArray<MountPullRequestLink> => {
  const latest = [...links].sort((left, right) =>
    right.lastObservedAt.localeCompare(left.lastObservedAt),
  )[0];
  return latest === undefined ? [] : [latest];
};

export const loadSessionWorkRecord = ({ set, get }: SliceDeps) => {
  const latest = createLatestOnly();
  return async ({ sessionId }: SessionKeyInput): Promise<void> => {
    await latest.run({
      key: sessionId,
      request: async (): Promise<WorkRecord> => {
        const views = await loadMountViews({ get, sessionId });
        const linkLists = await Promise.all(
          views.map((view) =>
            listMountPullRequestLinks({ db: tauriDatabase, sessionId, mountId: view.id }),
          ),
        );
        return { views, links: linkLists.flatMap((links) => latestLinkOf({ links })) };
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
