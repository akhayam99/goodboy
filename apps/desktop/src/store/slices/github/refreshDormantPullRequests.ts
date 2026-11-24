import { listPrsForBranches } from '@goodboy/core/github';
import {
  insertSessionEvent,
  listDormantOpenPullRequests,
  upsertMountPullRequestLink,
} from '@goodboy/db';
import type {
  IsoDateTime,
  PullRequestState,
  SessionEventId,
  SessionEventKind,
  WorkspaceId,
} from '@goodboy/types';
import { tauriGhRunner } from '../../../features/integrations/github/github';
import { tauriDatabase } from '../../../shared/lib/db';
import { runWithLimit } from '../../../shared/utils/runWithLimit';
import { toMountPullRequestLink } from './mountPrLink';
import { REVIEW_REFRESH_CONCURRENCY } from '../review-source/requestRefreshConcurrency';
import type { GetFn } from './types';

const DORMANT_PULL_REQUEST_CAP = 60;

const SETTLED_KIND: Partial<Record<string, SessionEventKind>> = {
  merged: 'pr_merged',
  closed: 'pr_closed',
};

type DormantPullRequestLink = Awaited<ReturnType<typeof listDormantOpenPullRequests>>[number];

type SettleParams = {
  readonly dormant: DormantPullRequestLink;
  readonly pr: PullRequestState;
};

const settleDormantLink = async ({ dormant, pr }: SettleParams): Promise<number> => {
  const { sessionId, projectId, link } = dormant;
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
};

type RepositoryParams = {
  readonly workspaceId: WorkspaceId;
  readonly repository: string;
  readonly members: ReadonlyArray<DormantPullRequestLink>;
};

const settleRepository = async ({
  workspaceId,
  repository,
  members,
}: RepositoryParams): Promise<number> => {
  const projectId = members.find((member) => member.projectId !== null)?.projectId ?? null;
  const byBranch = await listPrsForBranches({
    runner: tauriGhRunner,
    repo: repository,
    branches: members.map((member) => member.link.headBranch),
    opts: { workspaceId, ...(projectId === null ? {} : { projectId }) },
  }).catch(() => null);
  if (byBranch === null) {
    return 0;
  }
  let settled = 0;
  for (const dormant of members) {
    const pr = byBranch
      .get(dormant.link.headBranch)
      ?.find((candidate) => candidate.number === dormant.link.prNumber);
    if (pr === undefined) {
      continue;
    }
    settled += await settleDormantLink({ dormant, pr });
  }
  return settled;
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
    const byRepository = new Map<string, Array<DormantPullRequestLink>>();
    for (const item of dormant) {
      const key = item.link.repoSlug;
      byRepository.set(key, [...(byRepository.get(key) ?? []), item]);
    }
    const settled = await runWithLimit({
      limit: REVIEW_REFRESH_CONCURRENCY,
      tasks: [...byRepository.entries()].map(
        ([repository, members]) =>
          () =>
            settleRepository({ workspaceId, repository, members }),
      ),
    });
    return settled.reduce((sum, count) => sum + count, 0);
  };
};
