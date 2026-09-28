import type { SessionId } from '@goodboy/types';
import { tauriGhRunner } from '../../../features/github/github';
import { prWriteContext } from './prWriteContext';
import type { GetFn, SetFn } from './types';
import { ReportedError } from '../notifications/reportedError';

const REQUEST_REVIEW_FAILURE_TITLE = "Couldn't request a review";

export const requestReview = (_set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, prNumber: number, reviewers: ReadonlyArray<string>) => {
    const logins = reviewers.map((r) => r.trim()).filter(Boolean);
    if (logins.length === 0) {
      return;
    }
    const { session, repo } = prWriteContext({
      get,
      sessionId,
      prNumber,
      failureTitle: () => REQUEST_REVIEW_FAILURE_TITLE,
    });

    const res = await tauriGhRunner.run(
      ['pr', 'edit', String(prNumber), '--add-reviewer', logins.join(',')],
      {
        cwd: repo.repoRoot,
        workspaceId: session.workspaceId,
        projectId: repo.projectId,
      },
    );
    if (res.exitCode !== 0) {
      const errMsg = res.stderr.trim() || `gh pr edit --add-reviewer exited with ${res.exitCode}`;
      void get().emitNotification({
        kind: 'error',
        severity: 'error',
        title: REQUEST_REVIEW_FAILURE_TITLE,
        body: errMsg,
        sessionId,
        workspaceId: session.workspaceId,
      });
      throw new ReportedError(errMsg);
    }
    await get().refreshSessionPrDetail(sessionId, { force: true });
  };
};
