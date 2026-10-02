import { viewPullRequest } from '@goodboy/core';
import {
  insertSessionEvent,
  listDormantOpenPullRequests,
  upsertMountPullRequestLink,
} from '@goodboy/db';
import type { IsoDateTime, SessionEventId, SessionEventKind, WorkspaceId } from '@goodboy/types';
import { tauriGhRunner } from '../../../features/integrations/github/github';
import { tauriDatabase } from '../../../shared/lib/db';
import { runWithLimit } from '../../../shared/utils/runWithLimit';
import { toMountPullRequestLink } from './mountPrLink';
import { REVIEW_REFRESH_CONCURRENCY } from './sweepGithub';
import type { GetFn } from './types';

const DORMANT_PULL_REQUEST_CAP = 20;

const SETTLED_KIND: Partial<Record<string, SessionEventKind>> = {
  merged: 'pr_merged',
  closed: 'pr_closed',
};

export const refreshDormantPullRequests = (get: GetFn) => {
  return async (workspaceId: WorkspaceId): Promise<number> => {
    if (get().githubStatus?.available !== true) {
      return 0;
    }
    const dormant = await listDormantOpenPullRequests({
      db: tauriDatabase,
      workspaceId,
      limit: DORMANT_PULL_REQUEST_CAP,
    });
    const settled = await runWithLimit({
      limit: REVIEW_REFRESH_CONCURRENCY,
      tasks: dormant.map(({ sessionId, projectId, link }) => async (): Promise<number> => {
        const pr = await viewPullRequest({
          runner: tauriGhRunner,
          repo: link.repoSlug,
          number: link.prNumber,
          opts: { workspaceId, ...(projectId === null ? {} : { projectId }) },
        }).catch(() => null);
        if (pr === null) {
          return 0;
        }
        const observedAt = new Date().toISOString() as IsoDateTime;
        const next = toMountPullRequestLink({
          mountId: link.mountId,
          repository: link.repoSlug,
          pr,
          existing: link,
          observedAt,
        });
        await upsertMountPullRequestLink({ db: tauriDatabase, sessionId, link: next });
        const kind = next.state === link.state ? undefined : SETTLED_KIND[next.state];
        if (kind === undefined) {
          return 0;
        }
        await insertSessionEvent({
          db: tauriDatabase,
          event: {
            id: crypto.randomUUID() as SessionEventId,
            sessionId,
            kind,
            payload: {
              mountId: next.mountId,
              ...(projectId === null ? {} : { projectId }),
              provider: next.provider,
              host: next.host,
              repository: next.repoSlug,
              number: next.prNumber,
              title: pr.title,
              url: pr.url,
              branch: next.headBranch,
            },
            createdAt: next.mergedAt ?? observedAt,
          },
        });
        return 1;
      }),
    });
    return settled.reduce((sum, count) => sum + count, 0);
  };
};
