import { listMountPullRequestLinks, listSessionMounts } from '@goodboy/db';
import type {
  MountPullRequestLink,
  Project,
  SessionId,
  SessionMountView,
  SessionProjectMount,
} from '@goodboy/types';
import type { AppState } from '../../../types';
import { tauriDatabase } from '../../../../shared/lib/db';
import { viewsFromProjectMounts } from '../mountRowModel';
import { mountViewOf } from '../mountViews';
import { canonicalPullRequestLinkOf } from './canonicalPullRequestLinkOf';

type Params = {
  readonly projects: ReadonlyArray<Project>;
  readonly sessionIds: ReadonlyArray<SessionId>;
};

export type WorkspaceMountHistory = Readonly<{
  removed: Readonly<Record<string, ReadonlyArray<SessionMountView>>>;
  mountPrLinks: Readonly<Record<string, MountPullRequestLink>>;
}>;

export const loadWorkspaceMountHistory = async ({
  projects,
  sessionIds,
}: Params): Promise<WorkspaceMountHistory> => {
  const [mounts, links] = await Promise.all([
    listSessionMounts({ db: tauriDatabase, sessionIds }),
    listMountPullRequestLinks({ db: tauriDatabase, sessionIds }),
  ]);
  const removed: Record<string, Array<SessionMountView>> = {};
  for (const mount of mounts) {
    const view = mountViewOf({ mount, projects });
    if (view !== null) {
      removed[view.sessionId] = [...(removed[view.sessionId] ?? []), view];
    }
  }
  const mountPrLinks: Record<string, MountPullRequestLink> = {};
  for (const mountId of new Set(links.map((link) => link.mountId))) {
    const canonical = canonicalPullRequestLinkOf({
      links: links.filter((link) => link.mountId === mountId),
    });
    if (canonical !== null) {
      mountPrLinks[mountId] = canonical;
    }
  }
  return { removed, mountPrLinks };
};

type MountsParams = {
  readonly mounts: Readonly<Record<string, ReadonlyArray<SessionProjectMount>>>;
  readonly removed: Readonly<Record<string, ReadonlyArray<SessionMountView>>>;
};

const seededMountsOf = ({
  mounts,
  removed,
}: MountsParams): Readonly<Record<string, ReadonlyArray<SessionMountView>>> =>
  Object.fromEntries(
    Object.entries(removed).flatMap(([key, views]) => {
      const [first] = views;
      if (first === undefined) {
        return [];
      }
      const attached = viewsFromProjectMounts({
        mounts: mounts[key] ?? [],
        sessionId: first.sessionId,
      });
      return [[key, [...attached, ...views]]];
    }),
  );

type PatchParams = {
  readonly state: Pick<AppState, 'sessionMounts' | 'mountPrLinks'>;
  readonly mounts: MountsParams['mounts'];
  readonly history: WorkspaceMountHistory;
};

export const mountHistoryPatchOf = ({ state, mounts, history }: PatchParams) => ({
  sessionMounts: {
    ...state.sessionMounts,
    ...seededMountsOf({ mounts, removed: history.removed }),
  },
  mountPrLinks: { ...state.mountPrLinks, ...history.mountPrLinks },
});

type ReseedParams = {
  readonly state: Pick<AppState, 'sessionMounts'>;
  readonly mounts: MountsParams['mounts'];
  readonly sessionIds: ReadonlyArray<string>;
};

export const reseededMountsOf = ({ state, mounts, sessionIds }: ReseedParams) => ({
  ...state.sessionMounts,
  ...seededMountsOf({
    mounts,
    removed: Object.fromEntries(
      sessionIds.map((id) => [
        id,
        (state.sessionMounts[id] ?? []).filter((view) => !view.isAttached),
      ]),
    ),
  }),
});
