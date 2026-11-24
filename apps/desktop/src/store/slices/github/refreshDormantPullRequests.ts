import { listPrsForBranches, viewPullRequest } from '@goodboy/core/github';
import {
  insertSessionEvent,
  listDormantOpenPullRequests,
  upsertMountPullRequestLink,
} from '@goodboy/db';
import type {
  IsoDateTime,
  ProjectId,
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

type DormantBatch = {
  readonly repository: string;
  readonly projectId: ProjectId | null;
  readonly members: Array<DormantPullRequestLink>;
};

type BatchParams = {
  readonly workspaceId: WorkspaceId;
  readonly batch: DormantBatch;
};

type FindParams = BatchParams & {
  readonly byBranch: ReadonlyMap<string, ReadonlyArray<PullRequestState>>;
  readonly dormant: DormantPullRequestLink;
};

const findPullRequest = async ({
  workspaceId,
  batch,
  byBranch,
  dormant,
}: FindParams): Promise<PullRequestState | null> => {
  const listed = byBranch
    .get(dormant.link.headBranch)
    ?.find((candidate) => candidate.number === dormant.link.prNumber);
  if (listed !== undefined) {
    return listed;
  }
  return viewPullRequest({
    runner: tauriGhRunner,
    repo: batch.repository,
    number: dormant.link.prNumber,
    opts: { workspaceId, ...(batch.projectId === null ? {} : { projectId: batch.projectId }) },
  }).catch(() => null);
};

const settleBatch = async ({ workspaceId, batch }: BatchParams): Promise<number> => {
  const { repository, projectId, members } = batch;
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
    const pr = await findPullRequest({ workspaceId, batch, byBranch, dormant });
    if (pr === null) {
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
    const batches = new Map<string, DormantBatch>();
    for (const item of dormant) {
      const key = JSON.stringify([item.link.repoSlug, item.projectId]);
      const batch = batches.get(key) ?? {
        repository: item.link.repoSlug,
        projectId: item.projectId,
        members: [],
      };
      batch.members.push(item);
      batches.set(key, batch);
    }
    const settled = await runWithLimit({
      limit: REVIEW_REFRESH_CONCURRENCY,
      tasks: [...batches.values()].map((batch) => () => settleBatch({ workspaceId, batch })),
    });
    return settled.reduce((sum, count) => sum + count, 0);
  };
};
