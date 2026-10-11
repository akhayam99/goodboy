import { useEffect, useState } from 'react';
import type {
  Project,
  ProjectId,
  Session,
  SessionProjectMount,
  WorkspaceId,
  WorktreeStatus,
} from '@goodboy/types';
import { brandedId } from '../../../../../features/history/testing/brandedId';
import { JobBanner } from '../../../../../features/history/JobBanner';
import {
  A_REBASE_MOUNT_ID,
  A_REBASE_SESSION_ID,
  aRebaseRun,
} from '../../../../../features/history/testing/aRebaseRun';
import { useAppStore } from '../../../../../store';
import { sceneClock } from '../../sceneClock';
import { mockSceneIpc } from '../mockSceneIpc';
import { installSceneDatabase } from '../sceneDatabase';
import { installScenePlanEngine } from '../scenePlanEngine';

type Props = {
  readonly state: 'choosing' | 'done' | 'restore-conflict' | 'set-aside';
};

const clock = sceneClock({ anchor: '2026-10-10T09:12:00.000Z' });
const now = clock.iso({ at: '2026-10-10T09:12:00.000Z' });
const workspaceId = brandedId<WorkspaceId>({ value: 'workspace-harborline' });
const project: Project = {
  id: brandedId<ProjectId>({ value: 'project-payments-api' }),
  workspaceId,
  name: 'payments-api',
  rootPath: '/repos/payments-api',
  kind: 'repo',
  baseBranch: 'main',
  overrides: {
    defaultProviderId: null,
    defaultBranchPrefix: null,
    defaultBranchTemplate: null,
    defaultVerbosity: null,
    providerBindings: null,
    taskModels: null,
    roleModels: null,
    parallelAgents: null,
    providerPool: null,
    attributionFooter: null,
    replyVoice: null,
    replyStyleNote: null,
    replyTemplateFixed: null,
    replyTemplateNoChange: null,
    resolveOnGithub: null,
    resolveCommitStyle: null,
    afterMerge: null,
    workflowRules: null,
  },
  createdAt: now,
  updatedAt: now,
};
const session: Session = {
  id: A_REBASE_SESSION_ID,
  workspaceId,
  goal: 'Ledger export',
  state: { kind: 'draft' },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: false },
  permissionMode: 'default',
  autoRun: false,
  titleUserEdited: false,
  workflowRuns: [],
  createdAt: now,
  updatedAt: now,
};
const worktreePath = '/w/payments-api';
const identity = { worktreePath, branch: 'hl/ledger-export', projectId: project.id };
const mount: SessionProjectMount = {
  mountId: A_REBASE_MOUNT_ID,
  sessionId: A_REBASE_SESSION_ID,
  projectId: project.id,
  mountName: 'payments-api',
  worktreePath,
  lastWorktreePath: null,
  repoRoot: '/repos/payments-api',
  branch: identity.branch,
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
};
const status: WorktreeStatus = {
  branch: identity.branch,
  head: 'old-head',
  headSubject: 'Acme ledger export',
  upstream: null,
  upstreamDistance: { kind: 'unknown', reason: 'no-upstream' },
  mainDistance: { kind: 'known', ahead: 7, behind: 4 },
  workingTree: { kind: 'known', staged: 4, unstaged: 5, untracked: 2, unmerged: 0, changed: 11 },
  inProgress: null,
};

export const RebaseStashScene = ({ state }: Props) => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    installSceneDatabase();
    installScenePlanEngine({ sessionId: A_REBASE_SESSION_ID });
    mockSceneIpc((command) => {
      if (command === 'worktree_status') {
        return status;
      }
      if (command === 'history_remote_lease') {
        return { kind: 'absent' };
      }
      if (command === 'history_plan_apply') {
        return state === 'set-aside'
          ? { kind: 'files-restored', stash: 'a'.repeat(40) }
          : {
              kind: 'moved',
              head: 'new-head',
              backupRef: 'refs/goodboy/backup/hl-ledger-export/1',
              carriedCount: 0,
            };
      }
      return null;
    });
    const run = aRebaseRun({
      phase: state === 'done' ? 'applied' : state,
      commitCount: 7,
      identity,
      backupRef: state === 'done' ? 'refs/goodboy/backup/hl-ledger-export/1' : null,
      carriedCount: state === 'done' ? 11 : 0,
      dirtyChoice: { dirtyCount: 11, files: ['ledger.ts', 'batch.ts', 'webhook.ts', 'retries.ts'] },
      pendingMove: {
        kind: 'apply',
        input: {
          sessionId: A_REBASE_SESSION_ID,
          mountId: A_REBASE_MOUNT_ID,
          origin: 'rebase',
          planId: null,
          newHead: 'new-head',
          expectedHead: 'old-head',
          map: [],
          shouldPush: false,
          byAgent: false,
          identity,
        },
      },
      savedStash: {
        sha: 'a'.repeat(40),
        identity,
        expectedHead: 'old-head',
        files: ['ledger.ts', 'webhook.ts'],
      },
      updatedAt: clock.ms({ at: '2026-10-10T09:12:00.000Z' }),
    });
    useAppStore.setState({
      sessions: [session],
      projects: [project],
      sessionProjectMounts: { [A_REBASE_SESSION_ID]: [mount] },
      historyRuns: { [A_REBASE_MOUNT_ID]: run },
    });
    setIsReady(true);
  }, [state]);
  return (
    <main className="flex min-h-screen flex-col gap-6 bg-background p-8 text-foreground">
      <header className="flex flex-col gap-2">
        <span className="text-meta text-muted-foreground">Harborline / payments-api</span>
        <h1 className="text-title">Ledger export</h1>
        <span className="text-meta text-muted-foreground">hl/ledger-export</span>
      </header>
      {isReady ? <JobBanner sessionId={A_REBASE_SESSION_ID} worktreePath={worktreePath} /> : null}
      <section aria-label="Commits" className="flex flex-col gap-3 rounded-lg bg-subtle p-4">
        <h2 className="text-heading">Commits</h2>
        <span className="text-row">Add ledger export</span>
        <span className="text-row">Guard webhook retries</span>
        <span className="text-row">Stream export batches</span>
      </section>
    </main>
  );
};
