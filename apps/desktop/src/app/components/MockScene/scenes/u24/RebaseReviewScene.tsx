import { useEffect, useState } from 'react';
import type { AgentId, HistoryRewriterCheck, WorktreeStatus } from '@goodboy/types';
import { JobBanner } from '../../../../../features/history/JobBanner';
import { brandedId } from '../../../../../features/history/testing/brandedId';
import { useAppStore } from '../../../../../store';
import { sceneClock } from '../../sceneClock';
import { SESSION, seedActivityRunScene } from '../activityRunSeed';
import { mockSceneIpc } from '../mockSceneIpc';
import { installSceneDatabase } from '../sceneDatabase';
import { installScenePlanEngine } from '../scenePlanEngine';
import { rebaseJobRunOf } from './rebaseJobSeed';

const clock = sceneClock({ anchor: '2026-10-11T09:00:00.000Z' });
const agentId = brandedId<AgentId>({ value: 'mock-review-rewriter' });
const copyPath = '/copies/payments-api';
const diff =
  'diff --git a/webhook.ts b/webhook.ts\n--- a/webhook.ts\n+++ b/webhook.ts\n@@ -1 +1 @@\n-verify(event);\n+verify(event, { retries: 3 });\ndiff --git a/ledger.ts b/ledger.ts\n--- a/ledger.ts\n+++ b/ledger.ts\n@@ -1 +1 @@\n-exportBatch(rows);\n+exportBatch(rows, { deduplicate: true });\n';
const check: HistoryRewriterCheck = {
  head: null,
  map: [],
  problems: ['The result differs from what the plan should make.'],
  isTreeEqual: false,
  changedFiles: [],
  unexpectedFiles: ['webhook.ts', 'ledger.ts'],
  review: {
    copyHead: 'copy-head',
    diff,
    keptUntil: clock.ms({ at: '2026-10-12T09:00:00.000Z' }) / 1_000,
  },
};

type Props = {
  readonly isExpanded?: boolean;
};

export const RebaseReviewScene = ({ isExpanded = true }: Props) => {
  const [worktreePath, setWorktreePath] = useState<string | null>(null);
  useEffect(() => {
    seedActivityRunScene();
    installSceneDatabase();
    installScenePlanEngine({ sessionId: SESSION.id });
    const mount = useAppStore.getState().sessionProjectMounts[SESSION.id]?.[0];
    if (mount === undefined) {
      throw new Error('The scene needs a mount.');
    }
    const identity = {
      worktreePath: mount.worktreePath,
      branch: mount.branch,
      projectId: mount.projectId,
    };
    const status: WorktreeStatus = {
      branch: mount.branch,
      head: 'old-head',
      headSubject: 'Guard the ledger export',
      upstream: null,
      upstreamDistance: { kind: 'unknown', reason: 'no-upstream' },
      mainDistance: { kind: 'known', ahead: 7, behind: 4 },
      workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
      inProgress: null,
    };
    mockSceneIpc((command) => {
      if (command === 'worktree_status') {
        return status;
      }
      if (command === 'history_copy_git_dirs') {
        return {
          gitDir: '/copies/admin',
          objectsDir: '/copies/objects',
          packedRefsLock: '/copies/refs.lock',
        };
      }
      if (command === 'history_rewriter_collect') {
        return { ...check, head: 'new-head', problems: [], review: null };
      }
      if (command === 'history_remote_lease') {
        return { kind: 'absent' };
      }
      if (command === 'history_plan_apply') {
        return { kind: 'moved', head: 'new-head', backupRef: 'refs/goodboy/backup/1' };
      }
      return null;
    });
    const run = {
      ...rebaseJobRunOf({ state: 'result-differs', sessionId: SESSION.id }),
      mountId: mount.mountId,
      agentId,
      copyPath,
      identity,
      stop: {
        reason: 'invalid' as const,
        message: check.problems.join(' '),
        files: check.unexpectedFiles,
        sha: null,
        review: check.review,
      },
    };
    useAppStore.setState({
      historyRuns: { [mount.mountId]: run },
      historyRewriters: {
        [agentId]: {
          sessionId: SESSION.id,
          mountId: mount.mountId,
          copyPath,
          identity,
          origin: 'rebase',
          planId: null,
          plan: {
            worktreePath: mount.worktreePath,
            base: 'base-head',
            head: 'old-head',
            steps: [],
          },
        },
      },
    });
    setWorktreePath(mount.worktreePath);
  }, []);

  useEffect(() => {
    if (!isExpanded || worktreePath === null) {
      return;
    }
    const open = (): void => {
      const button = Array.from(document.querySelectorAll('button')).find(
        (item) => item.textContent === 'Review the change',
      );
      if (button !== undefined) {
        observer.disconnect();
        button.click();
      }
    };
    const observer = new MutationObserver(open);
    observer.observe(document.body, { childList: true, subtree: true });
    open();
    return () => observer.disconnect();
  }, [isExpanded, worktreePath]);

  return (
    <main className="flex min-h-screen flex-col gap-6 bg-background p-8 text-foreground">
      <header className="flex flex-col gap-2">
        <span className="text-meta text-muted-foreground">Harborline / payments-api</span>
        <h1 className="text-title">Ledger export</h1>
      </header>
      {worktreePath === null ? null : (
        <JobBanner sessionId={SESSION.id} worktreePath={worktreePath} />
      )}
      <section aria-label="Commits" className="flex flex-col gap-3">
        <h2 className="text-heading">Commits</h2>
        <span className="text-row">Guard webhook retries</span>
        <span className="text-row">Stream export batches</span>
      </section>
    </main>
  );
};
