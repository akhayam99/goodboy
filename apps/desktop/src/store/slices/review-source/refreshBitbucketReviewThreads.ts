import { bitbucketReviewSource } from '@goodboy/core';
import { formatError } from '@goodboy/ui';
import type { IsoDateTime, SessionId } from '@goodboy/types';
import { bitbucketReviewTransport } from '../../../features/integrations/bitbucket/bitbucketReviewTransport';
import { sessionMountTargets } from '../project-mounts/mountRequests';
import { bitbucketThreadsKey, openBitbucketPullRequestsOf } from './reviewSourceEntries';
import { syncSourceThreads } from './syncSourceThreads';
import type { GetFn, SetFn } from './types';
import { THREADS_TTL_MS, writeReviewSourceThreads } from './writeReviewSourceThreads';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly force?: boolean;
  readonly silent?: boolean;
};

export const refreshBitbucketReviewThreads = async ({
  set,
  get,
  sessionId,
  force = false,
  silent = false,
}: Params): Promise<void> => {
  const targets = sessionMountTargets({ state: get(), sessionId });
  await Promise.all(
    targets.flatMap((target) => {
      const bitbucket = get().mountBitbucketPr?.[target.id];
      const repo = bitbucket?.repo ?? null;
      if (bitbucket === undefined || repo === null) {
        return [];
      }
      return openBitbucketPullRequestsOf({ bitbucket }).map(async (pr) => {
        const key = bitbucketThreadsKey({ mountId: target.id, pr });
        const existing = get().reviewSourceThreads[sessionId]?.[key];
        const fetchedAt = existing?.fetchedAt ?? null;
        const age =
          fetchedAt === null ? Number.POSITIVE_INFINITY : Date.now() - Date.parse(fetchedAt);
        if (!force && (existing?.loading === true || age < THREADS_TTL_MS)) {
          return;
        }
        writeReviewSourceThreads({
          set,
          sessionId,
          key,
          patch: (current) => ({ ...current, loading: true, error: null }),
        });
        try {
          const source = bitbucketReviewSource({
            transport: bitbucketReviewTransport({ repo, pullRequestId: pr.id }),
            prUrl: pr.webUrl,
          });
          const threads = await source.listThreads();
          const comments = threads.flatMap((thread) => thread.comments);
          await syncSourceThreads({
            get,
            sessionId,
            kind: 'bitbucket',
            prNumber: pr.id,
            projectId: target.projectId,
            comments,
          });
          writeReviewSourceThreads({
            set,
            sessionId,
            key,
            patch: () => ({
              comments,
              fetchedAt: new Date().toISOString() as IsoDateTime,
              loading: false,
              error: null,
            }),
          });
        } catch (error) {
          writeReviewSourceThreads({
            set,
            sessionId,
            key,
            patch: (current) => ({
              ...current,
              loading: false,
              error: silent && current.fetchedAt !== null ? null : formatError(error),
            }),
          });
        }
      });
    }),
  );
};
