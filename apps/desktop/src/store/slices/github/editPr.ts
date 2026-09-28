import type { SessionId } from '@goodboy/types';
import { tauriGhRunner } from '../../../features/github/github';
import { prWriteContext } from './prWriteContext';
import type { GetFn, SetFn } from './types';
import { ReportedError } from '../notifications/reportedError';

const EDIT_FAILURE_TITLE = "Couldn't edit the pull request";

export type EditPrOptions = {
  title?: string;
  body?: string;
};

export const editPr = (_set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, prNumber: number, opts: EditPrOptions) => {
    const { session, repo } = prWriteContext({
      get,
      sessionId,
      prNumber,
      failureTitle: () => EDIT_FAILURE_TITLE,
    });

    const args = ['pr', 'edit', String(prNumber)];
    if (opts.title !== undefined) {
      args.push('--title', opts.title);
    }
    if (opts.body !== undefined) {
      args.push('--body', opts.body);
    }
    if (args.length === 3) {
      return;
    }

    const res = await tauriGhRunner.run(args, {
      cwd: repo.repoRoot,
      workspaceId: session.workspaceId,
      projectId: repo.projectId,
    });
    if (res.exitCode !== 0) {
      const errMsg = res.stderr.trim() || `gh pr edit exited with ${res.exitCode}`;
      void get().emitNotification({
        kind: 'error',
        severity: 'error',
        title: EDIT_FAILURE_TITLE,
        body: errMsg,
        sessionId,
        workspaceId: session.workspaceId,
      });
      throw new ReportedError(errMsg);
    }
    await get().refreshSessionPr(sessionId, { force: true });
  };
};
