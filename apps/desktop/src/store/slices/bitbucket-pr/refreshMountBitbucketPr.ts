import { bitbucketChecksOf, bitbucketReviewDecisionOf } from '@goodboy/core';
import { listMountPullRequestLinks } from '@goodboy/db';
import type { IsoDateTime, MountId, SessionId } from '@goodboy/types';
import {
  bitbucketGetPullRequest,
  bitbucketListPullRequestStatuses,
  bitbucketPullRequestForBranch,
  type BitbucketPullRequest,
  type BitbucketRepo,
  type BitbucketStatus,
} from '../../../features/integrations/bitbucket/client';
import { tauriDatabase } from '../../../shared/lib/db';
import type { MountBitbucketPrState } from './state';
import type { MountFetch } from '../project-mounts/mountRequests';
import {
  mergeLinkedRequests,
  refreshMountRequest,
  syncRequestLinks,
} from '../project-mounts/refreshMountRequest';
import {
  bitbucketRepository,
  bitbucketRequestIdentity,
  bitbucketRequestUrl,
  pullRequestFromLink,
  toMountBitbucketPrLink,
} from './bitbucketPrLink';
import { applyMountBitbucketPr } from './mountBitbucketPr';
import { resolveBitbucketPrContext, type BitbucketPrContext } from './resolveBitbucketPrContext';
import type { GetFn, SetFn } from './types';

export type RefreshSessionBitbucketPrOptions = {
  readonly mountId?: MountId;
  readonly force?: boolean;
  readonly silent?: boolean;
};

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly target: MountFetch;
  readonly opts?: RefreshSessionBitbucketPrOptions;
};

type StatusesRead = Readonly<
  | { kind: 'skipped' }
  | { kind: 'failed' }
  | { kind: 'read'; statuses: ReadonlyArray<BitbucketStatus> }
>;

const openStatusesOf = async ({
  repo,
  pr,
}: {
  readonly repo: BitbucketRepo;
  readonly pr: BitbucketPullRequest | null;
}): Promise<StatusesRead> => {
  if (pr === null || pr.state !== 'OPEN') {
    return { kind: 'skipped' };
  }
  try {
    return {
      kind: 'read',
      statuses: await bitbucketListPullRequestStatuses({ ...repo, pullRequestId: pr.id }),
    };
  } catch {
    return { kind: 'failed' };
  }
};

const checksAfterRead = ({
  current,
  pr,
  statuses,
}: {
  readonly current: MountBitbucketPrState;
  readonly pr: BitbucketPullRequest | null;
  readonly statuses: StatusesRead;
}): MountBitbucketPrState['checks'] => {
  if (statuses.kind === 'skipped') {
    return null;
  }
  if (statuses.kind === 'failed') {
    return current.pr !== null && pr !== null && current.pr.id === pr.id ? current.checks : null;
  }
  return bitbucketChecksOf({ statuses: statuses.statuses });
};

export const refreshMountBitbucketPr = async ({
  set,
  get,
  sessionId,
  target,
  opts,
}: Params): Promise<void> => {
  const mount = target.mount;
  const mountId = mount.id;
  await refreshMountRequest<MountBitbucketPrState, BitbucketPrContext>({
    set,
    get,
    sessionId,
    mount,
    opts,
    adapter: {
      read: (state) => state.mountBitbucketPr?.[mountId],
      apply: ({ state, entry }) =>
        applyMountBitbucketPr({ state, sessionId, mountId, bitbucket: entry }),
      resolveContext: async ({ isCurrent }) => {
        const context = await resolveBitbucketPrContext({ get, target });
        return context === null || !isCurrent() ? null : context;
      },
      pendingEntry: ({ existing, context }) => ({
        mountId,
        projectId: mount.projectId,
        revision: mount.revision,
        host: existing?.host ?? null,
        repo: context.repo,
        repository: bitbucketRepository({
          workspaceSlug: context.repo.workspaceSlug,
          repoSlug: context.repo.repoSlug,
        }),
        branch: mount.branch,
        prs: existing?.prs ?? [],
        links: existing?.links ?? [],
        checks: existing?.checks ?? null,
        reviewDecision: existing?.reviewDecision ?? null,
        pr: existing?.pr ?? null,
        fetchedAt: existing?.fetchedAt ?? null,
        loading: true,
        error: null,
      }),
      load: async ({ context }) => {
        const repo = context.repo;
        const selected = get().mountSelectedBitbucketPr?.[mountId] ?? null;
        const storedLinks = await listMountPullRequestLinks({
          db: tauriDatabase,
          sessionId,
          mountId,
        });
        const pr =
          selected === null
            ? await bitbucketPullRequestForBranch({ ...repo, sourceBranch: mount.branch })
            : await bitbucketGetPullRequest({ ...repo, pullRequestId: selected.prNumber });
        const observedAt = new Date().toISOString() as IsoDateTime;
        const links = await syncRequestLinks<BitbucketPullRequest>({
          get,
          sessionId,
          projectId: mount.projectId,
          storedLinks,
          items: pr === null ? [] : [pr],
          identity: ({ item }) =>
            bitbucketRequestIdentity({ repo, pullRequestId: item.id, url: item.webUrl }),
          toLink: ({ item, previous }) =>
            toMountBitbucketPrLink({ mountId, repo, pr: item, existing: previous, observedAt }),
          describe: ({ item }) => ({
            title: item.title,
            url: bitbucketRequestUrl({ repo, pullRequestId: item.id, url: item.webUrl }),
          }),
        });
        const statuses = await openStatusesOf({ repo, pr });
        return {
          kind: 'settle',
          next: (current) =>
            current === undefined
              ? null
              : {
                  ...current,
                  checks: checksAfterRead({ current, pr, statuses }),
                  reviewDecision:
                    pr === null || pr.state !== 'OPEN'
                      ? null
                      : bitbucketReviewDecisionOf({ participants: pr.participants }),
                  host:
                    pr === null
                      ? current.host
                      : bitbucketRequestIdentity({ repo, pullRequestId: pr.id, url: pr.webUrl })
                          .host,
                  prs: mergeLinkedRequests({
                    fetched: pr === null ? [] : [pr],
                    links,
                    fromLink: pullRequestFromLink,
                    key: ({ item }) => item.id,
                  }),
                  links,
                  pr,
                  fetchedAt: observedAt,
                  loading: false,
                  error: null,
                },
        };
      },
      failedEntry: ({ current, error }) => ({ ...current, loading: false, error }),
    },
  });
};
