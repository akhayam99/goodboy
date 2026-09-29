import { gitlabReviewSource } from '@goodboy/core';
import { formatError } from '@goodboy/ui';
import type { IsoDateTime, SessionId } from '@goodboy/types';
import { gitlabReviewTransport } from '../../../features/integrations/gitlab/gitlabReviewTransport';
import { sessionMountTargets } from '../project-mounts/mountRequests';
import { syncSourceThreads } from './syncSourceThreads';
import type { GetFn, ReviewSourceThreads, SetFn } from './types';

const THREADS_TTL_MS = 30_000;

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly force?: boolean;
  readonly silent?: boolean;
};

const EMPTY: ReviewSourceThreads = { comments: [], fetchedAt: null, loading: false, error: null };

const write = ({
  set,
  sessionId,
  url,
  patch,
}: {
  readonly set: SetFn;
  readonly sessionId: SessionId;
  readonly url: string;
  readonly patch: (current: ReviewSourceThreads) => ReviewSourceThreads;
}): void =>
  set((state) => ({
    reviewSourceThreads: {
      ...state.reviewSourceThreads,
      [sessionId]: {
        ...state.reviewSourceThreads[sessionId],
        [url]: patch(state.reviewSourceThreads[sessionId]?.[url] ?? EMPTY),
      },
    },
  }));

export const refreshGitlabReviewThreads = async ({
  set,
  get,
  sessionId,
  force = false,
  silent = false,
}: Params): Promise<void> => {
  const state = get();
  const session = state.sessions.find((candidate) => candidate.id === sessionId);
  if (session === undefined) {
    return;
  }
  const targets = sessionMountTargets({ state, sessionId });
  await Promise.all(
    targets.map(async (target) => {
      const gitlab = get().mountGitlabMr?.[target.id];
      const mr = gitlab?.mr ?? null;
      if (
        gitlab === undefined ||
        mr === null ||
        gitlab.host === null ||
        gitlab.projectPath === null
      ) {
        return;
      }
      const url = mr.webUrl;
      const existing = get().reviewSourceThreads[sessionId]?.[url];
      const fetchedAt = existing?.fetchedAt ?? null;
      const age =
        fetchedAt === null ? Number.POSITIVE_INFINITY : Date.now() - Date.parse(fetchedAt);
      if (!force && (existing?.loading === true || age < THREADS_TTL_MS)) {
        return;
      }
      write({
        set,
        sessionId,
        url,
        patch: (current) => ({ ...current, loading: true, error: null }),
      });
      try {
        const source = gitlabReviewSource({
          transport: gitlabReviewTransport({
            workspaceId: session.workspaceId,
            projectId: target.projectId,
            host: gitlab.host,
            projectPath: gitlab.projectPath,
            mrIid: mr.iid,
          }),
          mrUrl: url,
        });
        const threads = await source.listThreads();
        const comments = threads.flatMap((thread) => thread.comments);
        await syncSourceThreads({
          get,
          sessionId,
          kind: 'gitlab',
          prNumber: mr.iid,
          projectId: target.projectId,
          comments,
        });
        write({
          set,
          sessionId,
          url,
          patch: () => ({
            comments,
            fetchedAt: new Date().toISOString() as IsoDateTime,
            loading: false,
            error: null,
          }),
        });
      } catch (error) {
        write({
          set,
          sessionId,
          url,
          patch: (current) => ({
            ...current,
            loading: false,
            error: silent && current.fetchedAt !== null ? null : formatError(error),
          }),
        });
      }
    }),
  );
};
