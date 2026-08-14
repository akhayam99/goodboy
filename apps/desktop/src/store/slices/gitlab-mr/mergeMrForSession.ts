import type { SessionId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { gitlabMergeMr } from '../../../features/integrations/gitlab/client';
import { resolveMrContext } from './resolveMrContext';
import type { GetFn, SetFn } from './types';

export const mergeMrForSession = (_set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId) => {
    const ctx = await resolveMrContext(get, sessionId);
    const mr = get().sessionGitlabMr[sessionId]?.mr ?? null;
    if (!ctx || !mr) {
      return;
    }
    try {
      await gitlabMergeMr(ctx.workspaceId, ctx.host, ctx.projectPath, mr.iid);
    } catch (err) {
      const errMsg = formatError(err);
      void get().emitNotification('error', 'error', `Merge of !${mr.iid} failed`, errMsg, {
        sessionId,
        workspaceId: ctx.workspaceId,
      });
      throw err;
    }
    await get().refreshSessionMr(sessionId, { force: true });
  };
};
