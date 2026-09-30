import { gitlabReviewSource } from '@goodboy/core';
import { formatError } from '@goodboy/ui';
import type { IsoDateTime, SessionId } from '@goodboy/types';
import { gitlabReviewTransport } from '../../../features/integrations/gitlab/gitlabReviewTransport';
import { sessionMountTargets } from '../project-mounts/mountRequests';
import { syncSourceThreads } from './syncSourceThreads';
import type { GetFn, SetFn } from './types';
import { THREADS_TTL_MS, writeReviewSourceThreads } from './writeReviewSourceThreads';
import { sessionById } from '../sessions/sessionIndex';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly force?: boolean;
  readonly silent?: boolean;
};

export const refreshGitlabReviewThreads = async ({
  set,
  get,
  sessionId,
  force = false,
  silent = false,
}: Params): Promise<void> => {
  const state = get();
  const session = sessionById(state.sessions, sessionId);
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
      writeReviewSourceThreads({
        set,
        sessionId,
        key: url,
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
        writeReviewSourceThreads({
          set,
          sessionId,
          key: url,
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
          key: url,
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
