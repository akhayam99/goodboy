import { listMountPullRequestLinks } from '@goodboy/db';
import type { IsoDateTime, MountId, ProjectId, SessionId } from '@goodboy/types';
import {
  gitlabGetMr,
  gitlabMrApprovalState,
  gitlabMrForBranch,
  type GitlabMergeRequest,
  type GitlabMrApprovalState,
} from '../../../features/integrations/gitlab/client';
import { tauriDatabase } from '../../../shared/lib/db';
import type { MountGitlabMrState } from './state';
import type { MountFetch } from '../project-mounts/mountRequests';
import {
  mergeLinkedRequests,
  refreshMountRequest,
  syncRequestLinks,
} from '../project-mounts/refreshMountRequest';
import { applyMountGitlabMr } from './mountGitlabMr';
import { gitlabRequestIdentity, mergeRequestFromLink, toMountMrLink } from './mrLink';
import { resolveMrContext, type MrContext } from './resolveMrContext';
import type { GetFn, SetFn } from './types';

export type RefreshMrOptions = {
  readonly mountId?: MountId;
  readonly force?: boolean;
  readonly silent?: boolean;
};

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly target: MountFetch;
  readonly opts?: RefreshMrOptions;
};

type MrFacts = {
  readonly mr: GitlabMergeRequest | null;
  readonly approvals: GitlabMrApprovalState | null;
};

const readMrFacts = async ({
  context,
  mr,
  projectId,
}: {
  readonly context: MrContext;
  readonly mr: GitlabMergeRequest | null;
  readonly projectId: ProjectId;
}): Promise<MrFacts> => {
  if (mr === null || mr.state !== 'opened') {
    return { mr, approvals: null };
  }
  const target = {
    workspaceId: context.workspaceId,
    projectId,
    host: context.host,
    projectPath: context.projectPath,
    mrIid: mr.iid,
  };
  const [detail, approvals] = await Promise.all([
    gitlabGetMr(target).catch(() => null),
    gitlabMrApprovalState(target).catch(() => null),
  ]);
  return { mr: detail ?? mr, approvals };
};

export const refreshMountMr = async ({
  set,
  get,
  sessionId,
  target,
  opts,
}: Params): Promise<void> => {
  const mount = target.mount;
  const mountId = mount.id;
  await refreshMountRequest<MountGitlabMrState, MrContext>({
    set,
    get,
    sessionId,
    mount,
    opts,
    adapter: {
      read: (state) => state.mountGitlabMr?.[mountId],
      apply: ({ state, entry }) => applyMountGitlabMr({ state, sessionId, mountId, gitlab: entry }),
      resolveContext: async ({ isCurrent }) => {
        const context = await resolveMrContext({ get, sessionId, target });
        return context === null || !isCurrent() ? null : context;
      },
      pendingEntry: ({ existing, context }) => ({
        mountId,
        projectId: mount.projectId,
        revision: mount.revision,
        host: existing?.host ?? context.host,
        projectPath: context.projectPath,
        branch: mount.branch,
        mrs: existing?.mrs ?? [],
        links: existing?.links ?? [],
        mr: existing?.mr ?? null,
        approvals: existing?.approvals ?? null,
        fetchedAt: existing?.fetchedAt ?? null,
        loading: true,
        error: null,
      }),
      load: async ({ context }) => {
        const storedLinks = await listMountPullRequestLinks({
          db: tauriDatabase,
          sessionId,
          mountId,
        });
        const found = await gitlabMrForBranch(
          context.workspaceId,
          context.host,
          context.projectPath,
          mount.branch,
        );
        const { mr, approvals } = await readMrFacts({
          context,
          mr: found,
          projectId: mount.projectId,
        });
        const observedAt = new Date().toISOString() as IsoDateTime;
        const links = await syncRequestLinks<GitlabMergeRequest>({
          get,
          sessionId,
          projectId: mount.projectId,
          storedLinks,
          items: mr === null ? [] : [mr],
          identity: ({ item }) =>
            gitlabRequestIdentity({
              host: context.host,
              projectPath: context.projectPath,
              mr: item,
            }),
          toLink: ({ item, previous }) =>
            toMountMrLink({
              mountId,
              host: context.host,
              projectPath: context.projectPath,
              mr: item,
              existing: previous,
              observedAt,
            }),
          describe: ({ item }) => ({ title: item.title, url: item.webUrl }),
        });
        return {
          kind: 'settle',
          next: (current) =>
            current === undefined
              ? null
              : {
                  ...current,
                  host: context.host,
                  projectPath: context.projectPath,
                  mrs: mergeLinkedRequests({
                    fetched: mr === null ? [] : [mr],
                    links,
                    fromLink: mergeRequestFromLink,
                    key: ({ item }) => item.webUrl,
                  }),
                  links,
                  mr,
                  approvals,
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
