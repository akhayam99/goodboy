import type { MountId, PullRequestState } from '@goodboy/types';
import { runWithLimit } from '../../../shared/utils/runWithLimit';
import type { SliceDeps } from '../../slice-types';
import type { SweepRequestsParams } from './types';
import { listSessionPrFetches } from '../github/resolveSessionPrFetch';
import { mountFetchFactsOf } from './mountFetchFactsOf';
import { prefetchGithubBranches, type GithubSweepTarget } from './prefetchGithubBranches';
import { refreshMountRequests } from './refreshMountRequests';
import { refreshMountThreads } from './refreshMountThreads';
import { REVIEW_REFRESH_CONCURRENCY } from './requestRefreshConcurrency';

const SWEEP_OPTIONS = { silent: true, retries: 1 } as const;

const FORCED_OPTIONS = { force: true } as const;

const MIN_GITHUB_TARGETS_TO_BATCH = 2;

type Prefetched = ReadonlyMap<MountId, ReadonlyArray<PullRequestState>>;

type RunParams = { readonly prefetched: Prefetched };

const NO_PREFETCH: Prefetched = new Map();

export const sweepRequests = ({ set, get }: SliceDeps) => {
  return ({
    shouldSkipUnknownRequest = false,
    sessionId,
    isForced = false,
  }: SweepRequestsParams = {}): Promise<void> => {
    const { sessions, currentSessionId } = get();
    const baseOptions = isForced ? FORCED_OPTIONS : SWEEP_OPTIONS;
    const tasks: Array<(prefetched: Prefetched) => Promise<void>> = [];
    const githubTargets: Array<GithubSweepTarget> = [];
    for (const session of sessions) {
      if (sessionId !== undefined && session.id !== sessionId) {
        continue;
      }
      for (const target of listSessionPrFetches({ state: get(), sessionId: session.id })) {
        const mountId = target.mount.id;
        const facts = mountFetchFactsOf({
          state: get(),
          workspaceId: session.workspaceId,
          mount: target.mount,
        });
        if (facts.isHostAvailable !== true || (!isForced && facts.isEnded)) {
          continue;
        }
        if (shouldSkipUnknownRequest && facts.fetchedAt !== null && !facts.hasRequest) {
          continue;
        }
        const repoSlug = target.mount.repoSlug;
        if (facts.host === 'github' && repoSlug !== null && repoSlug !== '') {
          githubTargets.push({
            mountId,
            repoSlug,
            branch: target.mount.branch,
            cwd: target.cwd,
            workspaceId: session.workspaceId,
            projectId: target.mount.projectId,
          });
        }
        tasks.push(async (prefetched) => {
          await refreshMountRequests({
            get,
            host: facts.host,
            sessionId: session.id,
            options: { ...baseOptions, mountId, prefetched: prefetched.get(mountId) },
          });
          if (session.id !== currentSessionId) {
            return;
          }
          await refreshMountThreads({
            set,
            get,
            host: facts.host,
            sessionId: session.id,
            options: { ...baseOptions, mountId },
          });
        });
      }
    }
    if (tasks.length === 0) {
      return Promise.resolve();
    }
    const run = ({ prefetched }: RunParams): Promise<void> =>
      runWithLimit({
        tasks: tasks.map((task) => () => task(prefetched)),
        limit: REVIEW_REFRESH_CONCURRENCY,
      }).then(() => undefined);
    if (githubTargets.length < MIN_GITHUB_TARGETS_TO_BATCH) {
      return run({ prefetched: NO_PREFETCH });
    }
    return prefetchGithubBranches({ targets: githubTargets })
      .catch(() => NO_PREFETCH)
      .then((prefetched) => run({ prefetched }));
  };
};
