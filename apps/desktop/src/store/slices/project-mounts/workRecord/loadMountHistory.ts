import type { SessionId, SessionMountView } from '@goodboy/types';
import { createLatestOnly } from '../../../runtime/state-writes/latestOnly';
import type { SetFn } from '../types';
import { loadCanonicalLinks } from './loadCanonicalLinks';

type Params = {
  readonly set: SetFn;
  readonly sessionId: SessionId;
  readonly views: ReadonlyArray<SessionMountView>;
};

const latest = createLatestOnly();

export const loadMountHistory = async ({ set, sessionId, views }: Params): Promise<void> => {
  const removed = views.filter((view) => !view.isAttached);
  if (removed.length === 0) {
    return;
  }
  await latest.run({
    key: sessionId,
    request: async () => ({ links: await loadCanonicalLinks({ sessionId, views: removed }) }),
    apply: ({ links }) => {
      set((state) => ({
        mountPrLinks: {
          ...state.mountPrLinks,
          ...Object.fromEntries(links.map((link) => [link.mountId, link])),
        },
      }));
    },
  });
};
