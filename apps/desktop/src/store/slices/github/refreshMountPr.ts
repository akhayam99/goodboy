import {
  detectRepoSlug,
  fetchLinkedIssues,
  listPrsForBranch,
  toCachedPullRequest,
} from '@goodboy/core';
import { listMountPullRequestLinks, upsertGithubPrCache } from '@goodboy/db';
import type {
  IsoDateTime,
  MountId,
  MountPullRequestIdentity,
  MountPullRequestLink,
  ProjectId,
  PullRequestState,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import { tauriGhRunner } from '../../../features/github/github';
import { tauriDatabase } from '../../../shared/lib/db';
import type { MountGithubState } from '../../types';
import { requestIdentityEquals } from '../project-mounts/mountRequests';
import {
  mergeLinkedRequests,
  refreshMountRequest,
  syncRequestLinks,
} from '../project-mounts/refreshMountRequest';
import { applyMountGithub, pullRequestFromLink } from './mountGithub';
import { githubRequestHost, githubRequestIdentity, toMountPullRequestLink } from './mountPrLink';
import { type MountPrFetch } from './resolveSessionPrFetch';
import type { GetFn, SetFn } from './types';

export type RefreshPrOptions = {
  readonly mountId?: MountId;
  readonly request?: MountPullRequestIdentity;
  readonly force?: boolean;
  readonly silent?: boolean;
  readonly retries?: number;
};

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly target: MountPrFetch;
  readonly opts?: RefreshPrOptions;
};

type CacheParams = {
  readonly repository: string;
  readonly branch: string;
  readonly pr: PullRequestState | null;
};

const persistBranchCache = async ({ repository, branch, pr }: CacheParams): Promise<void> => {
  try {
    await upsertGithubPrCache(tauriDatabase, {
      branch,
      repoSlug: repository,
      pr: toCachedPullRequest({ pr }),
      fetchedAt: new Date().toISOString() as IsoDateTime,
    });
  } catch {
    return;
  }
};

type GhOptions = {
  readonly cwd: string;
  readonly workspaceId: WorkspaceId;
  readonly projectId: ProjectId;
};

const mergeRequests = ({
  fetched,
  links,
}: {
  readonly fetched: ReadonlyArray<PullRequestState>;
  readonly links: ReadonlyArray<MountPullRequestLink>;
}): ReadonlyArray<PullRequestState> =>
  mergeLinkedRequests({
    fetched,
    links,
    fromLink: pullRequestFromLink,
    key: ({ item }) => item.url,
  });

export const refreshMountPr = async ({
  set,
  get,
  sessionId,
  target,
  opts,
}: Params): Promise<void> => {
  const mount = target.mount;
  const mountId = mount.id;
  const revision = mount.revision;
  await refreshMountRequest<MountGithubState, GhOptions>({
    set,
    get,
    sessionId,
    mount,
    opts,
    adapter: {
      read: (state) => state.mountGithub?.[mountId],
      apply: ({ state, entry }) => applyMountGithub({ state, sessionId, mountId, github: entry }),
      resolveContext: () => ({
        cwd: target.cwd,
        workspaceId: target.session.workspaceId,
        projectId: mount.projectId,
      }),
      pendingEntry: ({ existing }) => ({
        mountId,
        projectId: mount.projectId,
        revision,
        repository: existing?.repository ?? mount.repoSlug,
        host: existing?.host ?? null,
        branch: mount.branch,
        prs: existing?.prs ?? [],
        links: existing?.links ?? [],
        pr: existing?.pr ?? null,
        linkedIssues: existing?.linkedIssues ?? [],
        fetchedAt: existing?.fetchedAt ?? null,
        failedAt: existing?.failedAt ?? null,
        loading: true,
        error: null,
        detail: existing?.detail ?? null,
        detailFetchedAt: existing?.detailFetchedAt ?? null,
        detailLoading: existing?.detailLoading ?? false,
        detailError: existing?.detailError ?? null,
      }),
      load: async ({ existing, context: ghOptions, isCurrent }) => {
        const wanted = opts?.request ?? null;
        const repository =
          wanted?.repoSlug ??
          mount.repoSlug ??
          (await detectRepoSlug(
            tauriGhRunner,
            target.cwd,
            target.session.workspaceId,
            mount.projectId,
          ));
        const storedLinks = await listMountPullRequestLinks({
          db: tauriDatabase,
          sessionId,
          mountId,
        });
        const requested =
          wanted === null
            ? null
            : (storedLinks.find((link) =>
                requestIdentityEquals({ identity: wanted, candidate: link }),
              ) ?? null);
        const branch = requested?.headBranch ?? mount.branch;
        if (repository === null || repository === '') {
          return {
            kind: 'settle',
            next: (current) =>
              current === undefined
                ? null
                : {
                    ...current,
                    prs: mergeRequests({ fetched: [], links: storedLinks }),
                    links: storedLinks,
                    fetchedAt: new Date().toISOString() as IsoDateTime,
                    failedAt: null,
                    loading: false,
                    error: null,
                  },
          };
        }
        const fetched = await listPrsForBranch(tauriGhRunner, repository, branch, ghOptions);
        const observedAt = new Date().toISOString() as IsoDateTime;
        const nextLinks = await syncRequestLinks<PullRequestState>({
          get,
          sessionId,
          projectId: mount.projectId,
          storedLinks,
          items: fetched,
          identity: ({ item }) => githubRequestIdentity({ repository, pr: item }),
          toLink: ({ item, previous }) =>
            toMountPullRequestLink({
              mountId,
              repository,
              pr: item,
              existing: previous,
              observedAt,
            }),
          describe: ({ item }) => ({ title: item.title, url: item.url }),
        });
        if (!isCurrent()) {
          return { kind: 'stale' };
        }
        const prs = mergeRequests({ fetched, links: nextLinks });
        const canonical =
          requested === null ? (fetched[0] ?? null) : (existing?.pr ?? fetched[0] ?? null);
        const selected = get().mountSelectedPr?.[mountId] ?? null;
        const displayed =
          selected === null
            ? canonical
            : (prs.find((candidate) =>
                requestIdentityEquals({
                  identity: selected,
                  candidate: githubRequestIdentity({ repository, pr: candidate }),
                }),
              ) ?? canonical);
        const linkedIssues =
          displayed === null
            ? []
            : await fetchLinkedIssues(tauriGhRunner, repository, displayed, ghOptions);
        return {
          kind: 'settle',
          next: (current) => {
            const hasDisplayedChanged =
              current?.pr?.url !== canonical?.url || current?.repository !== repository;
            return {
              mountId,
              projectId: mount.projectId,
              revision,
              repository,
              host:
                canonical === null
                  ? (current?.host ?? null)
                  : githubRequestHost({ url: canonical.url }),
              branch: mount.branch,
              prs,
              links: nextLinks,
              pr: canonical,
              linkedIssues,
              fetchedAt: observedAt,
              failedAt: null,
              loading: false,
              error: null,
              detail: hasDisplayedChanged ? null : (current?.detail ?? null),
              detailFetchedAt: hasDisplayedChanged ? null : (current?.detailFetchedAt ?? null),
              detailLoading: hasDisplayedChanged ? false : (current?.detailLoading ?? false),
              detailError: hasDisplayedChanged ? null : (current?.detailError ?? null),
            };
          },
          ...(requested === null && {
            after: () => persistBranchCache({ repository, branch, pr: canonical }),
          }),
        };
      },
      failedEntry: ({ current, error }) => ({
        ...current,
        failedAt: new Date().toISOString() as IsoDateTime,
        loading: false,
        error,
      }),
    },
  });
};
