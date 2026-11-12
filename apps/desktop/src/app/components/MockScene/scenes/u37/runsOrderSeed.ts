import type { IsoDateTime, PullRequestState, SessionMountView } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { sceneClock } from '../../sceneClock';
import { C08_SESSION_ID } from '../u25/c08RunSeed';
import { seedRunsByBranch } from '../u36/runsListSeed';

const clock = sceneClock({ anchor: '2026-10-16T15:12:00.000Z' });

const MERGED_AT: IsoDateTime = clock.iso({ at: '2026-10-14T09:00:00.000Z' });

const MERGED_BRANCH = 'fix/duplicate-credit';

type MountParams = {
  readonly mount: SessionMountView;
};

const mergedPrOf = ({ mount }: MountParams): PullRequestState => ({
  number: 10198,
  title: 'Block duplicate credits on payout retries',
  url: 'https://github.com/harborline/payments-api/pull/10198',
  state: 'merged',
  mergeable: null,
  checks: 'success',
  baseBranch: 'main',
  headBranch: mount.branch,
  isDraft: false,
  reviewDecision: 'approved',
  body: '',
  updatedAt: MERGED_AT,
});

export const seedRunsOrder = (): void => {
  seedRunsByBranch();
  const state = useAppStore.getState();
  const mount = (state.sessionMounts[C08_SESSION_ID] ?? []).find(
    (candidate) => candidate.branch === MERGED_BRANCH,
  );
  if (mount === undefined) {
    return;
  }
  const pr = mergedPrOf({ mount });
  useAppStore.setState({
    mountGithub: {
      ...state.mountGithub,
      [mount.id]: {
        pr,
        prs: [pr],
        links: [],
        linkedIssues: [],
        fetchedAt: MERGED_AT,
        failedAt: null,
        loading: false,
        error: null,
        detail: null,
        detailFetchedAt: null,
        detailLoading: false,
        detailError: null,
        mountId: mount.id,
        projectId: mount.projectId,
        revision: 1,
        repository: 'harborline/payments-api',
        host: 'github.com',
        branch: mount.branch,
      },
    },
  });
};
