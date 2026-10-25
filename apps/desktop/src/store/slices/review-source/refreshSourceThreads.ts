import { formatError } from '@goodboy/ui';
import { isoNow } from '@goodboy/types/helpers';
import type { MountId, PrComment, ProjectId, SessionId } from '@goodboy/types';
import { mountRevision } from '../project-mounts/mountRequests';
import { beginThreadRequest } from './beginThreadRequest';
import { boundedThreadRead } from './boundedThreadRead';
import { syncSourceThreads } from './syncSourceThreads';
import type { GetFn, SetFn } from './types';
import { THREADS_TTL_MS, writeReviewSourceThreads } from './writeReviewSourceThreads';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly projectId: ProjectId | null;
  readonly kind: 'gitlab' | 'bitbucket';
  readonly key: string;
  readonly prNumber: number;
  readonly isForced: boolean;
  readonly isQuiet: boolean;
  readonly listComments: () => Promise<ReadonlyArray<PrComment>>;
};

export const refreshSourceThreads = async ({
  set,
  get,
  sessionId,
  mountId,
  projectId,
  kind,
  key,
  prNumber,
  isForced,
  isQuiet,
  listComments,
}: Params): Promise<void> => {
  const existing = get().reviewSourceThreads[sessionId]?.[key];
  const fetchedAt = existing?.fetchedAt ?? null;
  const age = fetchedAt === null ? Number.POSITIVE_INFINITY : Date.now() - Date.parse(fetchedAt);
  if (!isForced && (existing?.loading === true || age < THREADS_TTL_MS)) {
    return;
  }
  const revision = mountRevision({ state: get(), sessionId, mountId });
  const isLatest = beginThreadRequest({ sessionId, key });
  const isCurrent = (): boolean =>
    isLatest() && mountRevision({ state: get(), sessionId, mountId }) === revision;
  const settleStale = (): void => {
    if (!isLatest()) {
      return;
    }
    writeReviewSourceThreads({
      set,
      sessionId,
      key,
      patch: ({ current }) => ({ ...current, loading: false }),
    });
  };
  writeReviewSourceThreads({
    set,
    sessionId,
    key,
    patch: ({ current }) => ({ ...current, loading: true, error: null }),
  });
  try {
    const comments = await boundedThreadRead({ read: listComments });
    if (!isCurrent()) {
      settleStale();
      return;
    }
    await syncSourceThreads({
      get,
      sessionId,
      mountId,
      kind,
      prNumber,
      projectId,
      comments,
      isCurrent,
    });
    if (!isCurrent()) {
      settleStale();
      return;
    }
    writeReviewSourceThreads({
      set,
      sessionId,
      key,
      patch: () => ({ comments, fetchedAt: isoNow(), loading: false, error: null }),
    });
  } catch (error) {
    if (!isCurrent()) {
      settleStale();
      return;
    }
    writeReviewSourceThreads({
      set,
      sessionId,
      key,
      patch: ({ current }) => ({
        ...current,
        loading: false,
        error: isQuiet && current.fetchedAt !== null ? null : formatError(error),
      }),
    });
  }
};
