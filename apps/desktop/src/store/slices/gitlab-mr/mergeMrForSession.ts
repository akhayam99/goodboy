import type { MountId, PrMergeMethod, SessionId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { isPullRequestPortError } from '@goodboy/core';
import { mergeGitlabMr } from '../../../features/integrations/gitlab/mergeGitlabMr';
import { resolveMrContext, resolveSessionMrTarget } from './resolveMrContext';
import type { GetFn, SetFn } from './types';

export type MergeMrInput = {
  readonly sessionId: SessionId;
  readonly mountId?: MountId;
  readonly method?: PrMergeMethod;
  readonly expectedHeadSha?: string;
};

export const mergeMrForSession = (_set: SetFn, get: GetFn) => {
  return async ({ sessionId, mountId, method, expectedHeadSha }: MergeMrInput): Promise<void> => {
    const target = resolveSessionMrTarget({
      get,
      sessionId,
      ...(mountId === undefined ? {} : { mountId }),
    });
    if (target === null) {
      return;
    }
    const mr = get().mountGitlabMr?.[target.mount.id]?.mr ?? null;
    const context = await resolveMrContext({ get, sessionId, target });
    if (context === null || mr === null) {
      return;
    }
    try {
      await mergeGitlabMr({
        workspaceId: context.workspaceId,
        projectId: target.mount.projectId,
        host: context.host,
        projectPath: context.projectPath,
        mrIid: mr.iid,
        ...(method === undefined ? {} : { method }),
        expectedHeadSha: expectedHeadSha ?? mr.sha ?? null,
      });
    } catch (err) {
      const stale = isPullRequestPortError(err) && err.kind === 'stale_head' ? err : null;
      if (stale !== null) {
        void get().emitNotification({
          kind: 'error',
          severity: 'error',
          title: `Couldn't merge !${mr.iid}`,
          body: stale.message,
          sessionId,
          workspaceId: context.workspaceId,
        });
        await get().refreshSessionMr(sessionId, { force: true, mountId: target.mount.id });
        throw stale;
      }
      const errMsg = formatError(err);
      void get().emitNotification({
        kind: 'error',
        severity: 'error',
        title: `Couldn't merge !${mr.iid}`,
        body: errMsg,
        sessionId,
        workspaceId: context.workspaceId,
      });
      throw err;
    }
    await get().refreshSessionMr(sessionId, { force: true, mountId: target.mount.id });
  };
};
