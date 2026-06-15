import type { SessionId } from '@goodboy/types';
import { gitlabCreateMr } from '../../../features/integrations/gitlab/client';
import { formatError } from '../../../shared/lib/errors';
import { resolveMrContext } from './resolveMrContext';
import type { GetFn, SetFn } from './types';

export type CreateMrOptions = {
  title?: string;
  description?: string;
  targetBranch?: string;
  draft?: boolean;
};

export const createMrForSession = (_set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, opts?: CreateMrOptions) => {
    const ctx = await resolveMrContext(get, sessionId);
    if (!ctx) {
      throw new Error(
        'No GitLab project is linked to this session yet, open it once so its worktree resolves.',
      );
    }
    try {
      await gitlabCreateMr({
        workspaceId: ctx.workspaceId,
        host: ctx.host,
        projectPath: ctx.projectPath,
        sourceBranch: ctx.branch,
        targetBranch: opts?.targetBranch?.trim() || 'main',
        title: opts?.title?.trim() || ctx.goal,
        description: opts?.description ?? '',
        draft: opts?.draft ?? true,
      });
    } catch (err) {
      const errMsg = formatError(err);
      void get().emitNotification('error', 'error', 'MR creation failed', errMsg, {
        sessionId,
        workspaceId: ctx.workspaceId,
      });
      throw err;
    }
    await get().refreshSessionMr(sessionId, { force: true });
    void get().emitNotification('pr-created', 'success', `MR created for: ${ctx.goal}`, undefined, {
      sessionId,
      workspaceId: ctx.workspaceId,
    });
  };
};
