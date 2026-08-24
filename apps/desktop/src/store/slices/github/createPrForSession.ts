import type { SessionId } from '@goodboy/types';
import { tauriGhRunner } from '../../../features/github/github';
import { appendClosingReferences } from '../../../features/github/appendClosingReferences';
import { closingIssueReferences } from '../../../features/github/closingIssueReferences';
import { getSessionRepo } from '../worktrees/getSessionRepo';
import type { GetFn, SetFn } from './types';

export type CreatePrOptions = {
  title?: string;
  body?: string;
  base?: string;
  draft?: boolean;
};

export const createPrForSession = (_set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, opts?: CreatePrOptions) => {
    const branch = get().sessionBranches[sessionId];
    const session = get().sessions.find((s) => s.id === sessionId);
    if (!branch || !session) {
      throw new Error(
        'No branch is linked to this session yet, open it once so its worktree resolves.',
      );
    }
    const workspace = get().workspaces.find((w) => w.id === session.workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found for this session.');
    }
    const repo = getSessionRepo({ get, sessionId });
    if (repo == null || repo.branch.length === 0) {
      throw new Error(
        'No branch is linked to this session yet, open it once so its worktree resolves.',
      );
    }

    const linkedTasks = get().sessionExternalTasks[sessionId] ?? [];
    const args = ['pr', 'create'];
    const hasFields = opts?.title !== undefined || opts?.body !== undefined;
    if (hasFields) {
      const body = opts?.body ?? '';
      args.push('--title', opts?.title?.trim() || session.goal);
      args.push(
        '--body',
        appendClosingReferences({
          body,
          references: closingIssueReferences({ tasks: linkedTasks, branch: repo.branch, body }),
        }),
      );
    } else {
      args.push('--fill');
    }
    if (opts?.base?.trim()) {
      args.push('--base', opts.base.trim());
    }
    if ((opts?.draft ?? true) === true) {
      args.push('--draft');
    }

    const res = await tauriGhRunner.run(args, {
      cwd: repo.repoRoot,
      workspaceId: session.workspaceId,
      projectId: repo.projectId,
    });
    if (res.exitCode !== 0) {
      const errMsg = res.stderr.trim() || `gh pr create exited with ${res.exitCode}`;
      void get().emitNotification('error', 'error', 'PR creation failed', errMsg, {
        sessionId,
        workspaceId: workspace.id,
      });
      throw new Error(errMsg);
    }
    await get().refreshSessionPr(sessionId, { force: true });
    const filled = hasFields ? null : (get().sessionGithub[sessionId]?.pr ?? null);
    if (filled != null) {
      const references = closingIssueReferences({
        tasks: linkedTasks,
        branch: repo.branch,
        body: filled.body,
      });
      if (references.length > 0) {
        await get()
          .editPr(sessionId, filled.number, {
            body: appendClosingReferences({ body: filled.body, references }),
          })
          .catch(() => undefined);
      }
    }
    const created = get().sessionGithub[sessionId]?.pr ?? null;
    if (created != null) {
      await get().recordSessionEventOnce({
        sessionId,
        kind: 'pr_created',
        payload: { number: created.number, title: created.title, url: created.url },
      });
    }
    void get().emitNotification(
      'pr-created',
      'success',
      `PR created for: ${session.goal}`,
      undefined,
      { sessionId, workspaceId: workspace.id },
    );
  };
};
