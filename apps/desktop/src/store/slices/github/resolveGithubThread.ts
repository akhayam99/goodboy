import type { SessionId } from '@goodboy/types';
import { formatError } from '../../../shared/lib/errors';
import { markThreadResolvedNoPush } from './markThreadResolvedNoPush';
import { pushSessionBranch } from './pushSessionBranch';
import { withResolutionLock } from './withResolutionLock';
import type { GetFn, SetFn } from './types';

type Params = { commitSha?: string; reason?: string; reply?: string };

export const resolveGithubThread = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, threadId: string, closure?: Params): Promise<boolean> =>
    withResolutionLock<boolean>({
      sessionId,
      onBusy: () => {
        void get().emitNotification(
          'error',
          'warning',
          'resolve already running',
          'another resolve is still working on this session, so this thread was left alone.',
          { sessionId },
        );
        return false;
      },
      run: async () => {
        const session = get().sessions.find((candidate) => candidate.id === sessionId);
        if (session === undefined) {
          void get().emitNotification(
            'error',
            'error',
            'resolve thread failed',
            'the session is no longer loaded, so the thread was left open',
            { sessionId },
          );
          return false;
        }
        const workspace = get().workspaces.find(
          (candidate) => candidate.id === session.workspaceId,
        );
        const notifyTarget = {
          sessionId,
          ...(workspace !== undefined && { workspaceId: workspace.id }),
        };
        try {
          const commitSha = closure?.commitSha ?? '';
          if (commitSha !== '') {
            const push = await pushSessionBranch(get, sessionId);
            if (!push.ok) {
              void get().emitNotification(
                'error',
                'error',
                'push failed, thread left open',
                push.error,
                notifyTarget,
              );
              return false;
            }
          }
          await markThreadResolvedNoPush(set, get, sessionId, threadId, closure);
          await get().refreshSessionPrDetail(sessionId, { force: true });
          return true;
        } catch (err) {
          void get().emitNotification(
            'error',
            'error',
            'resolve thread failed',
            formatError(err),
            notifyTarget,
          );
          return false;
        }
      },
    });
};
