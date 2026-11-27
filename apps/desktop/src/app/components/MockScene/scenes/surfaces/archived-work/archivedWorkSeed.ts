import type { MountPullRequestLink, SessionMountView } from '@goodboy/types';
import { useAppStore } from '../../../../../../store';
import { sceneClock } from '../../../sceneClock';
import { COLUMN_SESSION_ID, seedCentralColumn } from '../../u26/centralColumnSeed';

export type ArchivedWorkVariant = 'archived' | 'merged';

type Params = {
  readonly variant: ArchivedWorkVariant;
};

const clock = sceneClock({ anchor: '2026-10-18T10:31:00.000Z' });

const ARCHIVED_AT = clock.iso({ at: '2026-10-18T10:00:00.000Z' });

type RemovedParams = {
  readonly isArchived: boolean;
  readonly linkState: MountPullRequestLink['state'];
};

const seedRemoved = ({ isArchived, linkState }: RemovedParams): void => {
  const state = useAppStore.getState();
  const mounts = state.sessionProjectMounts[COLUMN_SESSION_ID] ?? [];
  const views: ReadonlyArray<SessionMountView> = mounts.flatMap((mount) =>
    mount.mountId === undefined
      ? []
      : [
          {
            id: mount.mountId,
            sessionId: COLUMN_SESSION_ID,
            projectId: mount.projectId,
            worktreePath: null,
            lastWorktreePath: mount.worktreePath,
            branch: mount.branch,
            baseBranch: mount.baseBranch ?? null,
            parallelIndex: mount.parallelIndex ?? 0,
            mountName: mount.mountName,
            repoSlug: null,
            repoRoot: mount.repoRoot,
            isAttached: false,
            diskState: 'removed',
            revision: (mount.revision ?? 0) + 1,
            createdAt: ARCHIVED_AT,
            updatedAt: ARCHIVED_AT,
          },
        ],
  );
  const links: ReadonlyArray<MountPullRequestLink> = views.flatMap((view) => {
    const github = state.mountGithub[view.id];
    const pr = github?.pr ?? null;
    if (pr === null || github?.host == null || github.repository == null) {
      return [];
    }
    return [
      {
        id: `link-${view.id}`,
        mountId: view.id,
        provider: 'github',
        host: github.host,
        repoSlug: github.repository,
        prNumber: pr.number,
        headBranch: view.branch,
        baseBranch: view.baseBranch,
        url: pr.url,
        state: linkState,
        snapshot: null,
        mergedHeadSha: null,
        mergedAt: linkState === 'merged' ? ARCHIVED_AT : null,
        lastObservedAt: ARCHIVED_AT,
        createdAt: ARCHIVED_AT,
        updatedAt: ARCHIVED_AT,
      },
    ];
  });
  useAppStore.setState({
    sessions: isArchived
      ? state.sessions.map((session) =>
          session.id === COLUMN_SESSION_ID ? { ...session, archivedAt: ARCHIVED_AT } : session,
        )
      : state.sessions,
    sessionMounts: { [COLUMN_SESSION_ID]: views },
    sessionProjectMounts: { [COLUMN_SESSION_ID]: [] },
    sessionWorktrees: { [COLUMN_SESSION_ID]: [] },
    mountGithub: {},
    sessionGithub: {},
    mountPrLinks: Object.fromEntries(links.map((link) => [link.mountId, link])),
    loadSessionWorkRecord: async () => undefined,
  });
};

const seedMerged = (): void => {
  useAppStore.setState((state) => ({
    sessionGithub: Object.fromEntries(
      Object.entries(state.sessionGithub).map(([id, github]) => [
        id,
        github.pr === null ? github : { ...github, pr: { ...github.pr, state: 'merged' as const } },
      ]),
    ),
    mountGithub: Object.fromEntries(
      Object.entries(state.mountGithub).map(([id, github]) => [
        id,
        {
          ...github,
          pr: github.pr === null ? null : { ...github.pr, state: 'merged' as const },
          prs: github.prs.map((pr) => ({ ...pr, state: 'merged' as const })),
        },
      ]),
    ),
  }));
};

export const seedDeletedAfterMerge = (): void => {
  seedCentralColumn({ kind: 'finished' });
  seedRemoved({ isArchived: false, linkState: 'merged' });
};

export const seedArchivedWork = ({ variant }: Params): void => {
  seedCentralColumn({ kind: 'finished' });
  if (variant === 'archived') {
    seedRemoved({ isArchived: true, linkState: 'open' });
    return;
  }
  seedMerged();
};
