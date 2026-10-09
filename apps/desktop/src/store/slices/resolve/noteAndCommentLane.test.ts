// @vitest-environment node
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';
import {
  insertDiffComment,
  insertResolveAttempt,
  insertResolveQueueItem,
  listDiffCommentsForSession,
  listResolveCandidateItems,
  listResolveCandidates,
  listResolveQueueItems,
  listResolveThreads,
  upsertResolveThread,
  type Database,
} from '@goodboy/db';
import { makeMigratedTestDatabase } from '@goodboy/db/test-helpers';
import { aProject, aSession, aWorkspace, anAgent } from '@goodboy/types/testing';
import type {
  AgentId,
  MountId,
  ProjectId,
  ResolveAttempt,
  ResolveThread,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import { laneAcceptCountOf, laneAcceptNotesOf } from '../../../features/resolve/laneAcceptCount';
import { acceptUpToLabel } from '../../../features/resolve/laneCopy';
import { createResolveSlice } from './index';
import { laneChainOf, laneHolderOf, laneQueueOf, lanePathsOf } from './resolveLane';
import { resolveInitialState } from './state';
import { git, isAncestor, quarantineCandidate, splitCandidates } from './testing/gitWorktree';
import { useAppStore, type AppStore } from '../../store';

const h = vi.hoisted(() => ({
  execute: vi.fn(),
  select: vi.fn(),
  exec: vi.fn(),
  transaction: vi.fn(),
  leases: new Map<string, string>(),
  failFinalizeOnce: false,
  startBatch: vi.fn(async (_params: unknown) => ({})),
}));

vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: h }));

vi.mock('../../../features/resolve/startBatch', () => ({ startBatch: h.startBatch }));

vi.mock('../../../features/resolve/draftRouting', () => ({
  draftRoutingOf: () => ({ provider: 'anthropic', model: 'claude-sonnet-5', effort: null }),
}));

vi.mock('@goodboy/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@goodboy/db')>();
  return {
    ...actual,
    finalizeResolveCandidateIntegration: vi.fn(
      async (params: Parameters<typeof actual.finalizeResolveCandidateIntegration>[0]) => {
        if (h.failFinalizeOnce) {
          h.failFinalizeOnce = false;
          throw new Error('the database is locked');
        }
        return actual.finalizeResolveCandidateIntegration(params);
      },
    ),
  };
});

vi.mock('../../../features/worktree/worktree', () => {
  const freeLease = ({ path }: { readonly path: string }) => ({
    path,
    holder: null,
    token: null,
    runId: null,
    isGranted: false,
    hasExited: false,
    waiting: [],
  });
  const journalOf = ({
    worktreePath,
    candidateId,
  }: {
    readonly worktreePath: string;
    readonly candidateId: string;
  }): string =>
    join(
      git(worktreePath, ['rev-parse', '--absolute-git-dir']),
      'goodboy-candidate-integrations',
      `${candidateId}.journal`,
    );
  return {
    worktreeStatus: vi.fn(async ({ worktreePath }: { readonly worktreePath: string }) => ({
      branch: git(worktreePath, ['rev-parse', '--abbrev-ref', 'HEAD']),
      head: git(worktreePath, ['rev-parse', 'HEAD']),
    })),
    worktreeIsAncestor: vi.fn(
      async ({
        worktreePath,
        sha,
        head,
      }: {
        readonly worktreePath: string;
        readonly sha: string;
        readonly head: string;
      }) => isAncestor(worktreePath, sha, head),
    ),
    quarantineWorktreeCandidate: vi.fn(async (params: Parameters<typeof quarantineCandidate>[0]) =>
      quarantineCandidate(params),
    ),
    splitWorktreeCandidates: vi.fn(async (params: Parameters<typeof splitCandidates>[0]) =>
      splitCandidates(params),
    ),
    worktreeCommitRange: vi.fn(
      async ({
        worktreePath,
        base,
        head,
      }: {
        readonly worktreePath: string;
        readonly base: string;
        readonly head: string;
      }) =>
        git(worktreePath, ['log', '--reverse', '--format=%H%x1f%s', `${base}..${head}`])
          .split('\n')
          .filter((line) => line !== '')
          .map((line) => {
            const [sha = '', subject = ''] = line.split('\u001f');
            return { sha, subject };
          }),
    ),
    integrateWorktreeCandidate: vi.fn(
      async ({
        worktreePath,
        candidateId,
        candidateSha,
        expectedHead,
      }: {
        readonly worktreePath: string;
        readonly candidateId: string;
        readonly candidateSha: string;
        readonly expectedHead: string;
      }) => {
        const expected = git(worktreePath, ['rev-parse', expectedHead]);
        const candidate = git(worktreePath, ['rev-parse', candidateSha]);
        const actual = git(worktreePath, ['rev-parse', 'HEAD']);
        const journal = journalOf({ worktreePath, candidateId });
        if (existsSync(journal)) {
          const [recorded = '', landed = recorded] = readFileSync(journal, 'utf8')
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line !== '');
          if (recorded !== candidate) {
            throw new Error('the integration journal holds a different commit for this candidate');
          }
          if (isAncestor(worktreePath, landed, actual)) {
            return landed;
          }
        }
        if (!isAncestor(worktreePath, expected, candidate)) {
          throw new Error('the candidate is not based on the expected branch head');
        }
        if (!isAncestor(worktreePath, expected, actual)) {
          throw new Error(`the branch moved: expected head ${expected}, found ${actual}`);
        }
        if (git(worktreePath, ['status', '--porcelain', '--untracked-files=no']) !== '') {
          throw new Error(
            'uncommitted change(s) in the worktree: integrating would overwrite them',
          );
        }
        mkdirSync(dirname(journal), { recursive: true });
        if (actual === expected) {
          writeFileSync(journal, `${candidate}\n`);
          git(worktreePath, ['update-ref', 'HEAD', candidate, expected]);
          git(worktreePath, ['reset', '--hard', '--quiet', candidate]);
          return candidate;
        }
        const pending = git(worktreePath, ['cherry', actual, candidate, expected])
          .split('\n')
          .filter((line) => line !== '');
        if (pending.length > 0 && pending.every((line) => line.startsWith('- '))) {
          const landed = git(worktreePath, ['cherry', candidate, actual, expected])
            .split('\n')
            .filter((line) => line.startsWith('- '))
            .map((line) => line.slice(2).trim())
            .at(-1);
          if (landed !== undefined) {
            writeFileSync(journal, `${candidate}\n${landed}\n`);
            return landed;
          }
        }
        try {
          git(worktreePath, ['cherry-pick', '--allow-empty', `${expected}..${candidate}`]);
        } catch {
          try {
            git(worktreePath, ['cherry-pick', '--abort']);
          } catch {
            git(worktreePath, ['reset', '--hard', '--quiet', actual]);
          }
          git(worktreePath, ['reset', '--hard', '--quiet', actual]);
          throw new Error('the fix no longer applies on the branch');
        }
        const integrated = git(worktreePath, ['rev-parse', 'HEAD']);
        writeFileSync(journal, `${candidate}\n${integrated}\n`);
        return integrated;
      },
    ),
    acquireWorktreeWriter: vi.fn(
      async ({ path, holder }: { readonly path: string; readonly holder: string }) => {
        const current = h.leases.get(path);
        if (current !== undefined && current !== holder) {
          return { ...freeLease({ path }), holder: current };
        }
        h.leases.set(path, holder);
        return { ...freeLease({ path }), holder, token: 'token', isGranted: true };
      },
    ),
    releaseWorktreeWriter: vi.fn(
      async ({ path, holder }: { readonly path: string; readonly holder: string }) => {
        if (h.leases.get(path) === holder) {
          h.leases.delete(path);
        }
        return freeLease({ path });
      },
    ),
  };
});

const WORKSPACE_ID = 'ws-1' as WorkspaceId;
const MOUNT_ID = 'mount-1' as MountId;
const PROJECT_ID = 'project-1' as ProjectId;
const SESSION_ID = 'session-1' as SessionId;

let db: Database;
let repoRoot = '';
let worktreePath = '';

const mountTarget = () => ({ mountId: MOUNT_ID, mountRevision: 4, worktreePath });
let rootSha = '';

const makeThread = ({
  threadId,
  ...overrides
}: { readonly threadId: string } & Partial<ResolveThread>): ResolveThread => ({
  id: `row-${threadId}`,
  sessionId: SESSION_ID,
  projectId: PROJECT_ID,
  prNumber: 7,
  threadId,
  originKind: 'review_comment',
  diffCommentId: null,
  state: 'fixed',
  stage: 'new',
  stateReason: null,
  revision: 0,
  generation: 0,
  reopenedFromThreadId: null,
  activeAttemptId: null,
  disposition: 'reply',
  replyDraft: `Reply for ${threadId}`,
  commitShas: null,
  fixupOfSha: null,
  replacesSha: null,
  question: null,
  replyPostedAt: null,
  replyId: null,
  githubResolved: null,
  closedAt: null,
  closedSource: null,
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

const makeHarness = () => {
  const store = createStore<AppStore>((set, get) => {
    return {
      ...useAppStore.getInitialState(),
      ...resolveInitialState,
      sessions: [
        aSession({ id: SESSION_ID, workspaceId: WORKSPACE_ID, activeProjectId: PROJECT_ID }),
      ],
      workspaces: [aWorkspace({ id: WORKSPACE_ID })],
      projects: [aProject({ id: PROJECT_ID, workspaceId: WORKSPACE_ID })],
      sessionActiveProject: { [SESSION_ID]: PROJECT_ID },
      sessionProjectMounts: {
        [SESSION_ID]: [
          {
            mountId: MOUNT_ID,
            sessionId: SESSION_ID,
            projectId: PROJECT_ID,
            mountName: 'repo',
            worktreePath,
            lastWorktreePath: null,
            repoRoot,
            branch: 'feature/fix',
            baseBranch: 'main',
            parallelIndex: 0,
            isAttached: true,
            diskState: 'present',
            revision: 4,
          },
        ],
      },
      sessionGithub: {},
      diffComments: {},
      sessionPhaseRuns: {},
      ...createResolveSlice({ set, get }),
    };
  });
  return { store, actions: store.getState() };
};

const seedItem = async ({
  threadId,
  thread = {},
}: {
  readonly threadId: string;
  readonly thread?: Partial<ResolveThread>;
}): Promise<string> => {
  await upsertResolveThread({
    db,
    row: makeThread({ threadId, ...thread }),
    expectedRevision: null,
  });
  const rows = await listResolveQueueItems({ db, sessionId: SESSION_ID });
  const itemId = `item-${threadId}`;
  const revision =
    (
      await db.select<{ readonly revision: number }>(
        'SELECT revision FROM resolve_threads WHERE session_id = ? AND thread_id = ?',
        [SESSION_ID, threadId],
      )
    )[0]?.revision ?? 0;
  expect(rows.some((entry) => entry.item.id === itemId)).toBe(false);
  await insertResolveQueueItem({
    db,
    item: {
      id: itemId,
      sessionId: SESSION_ID,
      threadId,
      generation: 0,
      reopenedFromItemId: null,
      candidateRevision: revision,
      approvalState: 'none',
      approvedRevision: null,
      approvedReplyHash: null,
      integratedSha: null,
      deferredAt: null,
      deliveredAt: null,
      supersededAt: null,
      createdAt: 1,
      updatedAt: 1,
    },
  });
  return itemId;
};

const makeAttempt = ({
  id,
  createdAt,
}: {
  readonly id: string;
  readonly createdAt: number;
}): ResolveAttempt => ({
  id,
  sessionId: SESSION_ID,
  agentId: RESOLVER_ID as AgentId,
  prNumber: 7,
  threadIds: ['thread-a'],
  provider: 'anthropic',
  model: 'claude-opus-5-5',
  effort: null,
  instructions: 'fix it',
  phase: 'failed',
  mountTarget: mountTarget(),
  startedAt: createdAt,
  endedAt: createdAt + 1,
  error: 'interrupted',
  createdAt,
  batchId: null,
  copyPath: null,
  launchChoice: null,
});

const RESOLVER_ID = 'resolver-1';

let agentCwd = '';

const agentWrites = ({
  files,
  message,
}: {
  readonly files: ReadonlyArray<readonly [string, string]>;
  readonly message: string;
}): void => {
  const cwd = agentCwd === '' ? worktreePath : agentCwd;
  for (const [name, body] of files) {
    writeFileSync(join(cwd, name), body);
  }
  git(cwd, ['add', '--all']);
  git(cwd, ['commit', '--no-verify', '-m', message]);
};
beforeEach(async () => {
  db = await makeMigratedTestDatabase();
  h.exec.mockReset().mockImplementation(db.exec);
  h.execute.mockReset().mockImplementation(db.execute);
  h.select.mockReset().mockImplementation(db.select);
  h.transaction.mockReset().mockImplementation(db.transaction);
  h.leases.clear();
  h.failFinalizeOnce = false;
  h.startBatch.mockReset().mockImplementation(async (_params: unknown) => ({}));
  agentCwd = '';
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('ws-1', 'Workspace', 'workspace', 1, 1)",
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session-1', 'ws-1', 'Goal', 'idle', 1, 1)",
  );
  repoRoot = mkdtempSync(join(tmpdir(), 'goodboy-candidates-'));
  worktreePath = join(repoRoot, 'work');
  mkdirSync(worktreePath);
  git(worktreePath, ['init', '-b', 'feature/fix']);
  git(worktreePath, ['config', 'user.email', 'test@example.com']);
  git(worktreePath, ['config', 'user.name', 'Test']);
  git(worktreePath, ['config', 'commit.gpgsign', 'false']);
  writeFileSync(join(worktreePath, 'base.txt'), 'base\n');
  git(worktreePath, ['add', '--all']);
  git(worktreePath, ['commit', '--no-verify', '-m', 'base']);
  rootSha = git(worktreePath, ['rev-parse', 'HEAD']);
});

afterEach(() => {
  rmSync(repoRoot, { recursive: true, force: true });
});

const startRun = async ({
  harness,
  attemptId,
  threadIds,
  launchChoice = null,
}: {
  readonly harness: ReturnType<typeof makeHarness>;
  readonly attemptId: string;
  readonly threadIds: ReadonlyArray<string>;
  readonly launchChoice?: ResolveAttempt['launchChoice'];
}): Promise<void> => {
  const startSha = git(worktreePath, ['rev-parse', 'HEAD']);
  const copy = join(repoRoot, `copy-${attemptId}`);
  git(worktreePath, ['worktree', 'add', '--detach', '--quiet', copy, startSha]);
  agentCwd = copy;
  await insertResolveAttempt({
    db,
    attempt: {
      ...makeAttempt({ id: attemptId, createdAt: 10 }),
      threadIds,
      phase: 'running',
      error: null,
      copyPath: copy,
      launchChoice,
    },
  });
  await harness.actions.beginResolveCandidate({
    sessionId: SESSION_ID,
    attemptId,
    mountTarget: mountTarget(),
    baseSha: startSha,
  });
};

const commitFile = ({ name, body }: { readonly name: string; readonly body: string }): string => {
  agentWrites({ files: [[name, body]], message: `fix ${name}` });
  return git(agentCwd, ['rev-parse', 'HEAD']);
};

const NOTE_ID = 'note-backoff-cap';
const NOTE_THREAD = `note:${NOTE_ID}`;

const seedNote = async ({ sha }: { readonly sha: string }): Promise<string> => {
  await insertDiffComment(
    db,
    NOTE_ID,
    SESSION_ID,
    'src/webhooks/retryPolicy.ts',
    'Cap the backoff',
    {
      side: 'new',
      lineNumber: 42,
    },
  );
  return seedItem({
    threadId: NOTE_THREAD,
    thread: {
      originKind: 'diff_comment',
      diffCommentId: NOTE_ID,
      prNumber: null,
      sourceKind: 'local',
      disposition: 'fix',
      commitShas: [sha],
      replyDraft: null,
    },
  });
};

const candidatesWithItems = async () =>
  Promise.all(
    (await listResolveCandidates({ db, sessionId: SESSION_ID })).map(async (candidate) => ({
      candidate,
      items: await listResolveCandidateItems({ db, candidateId: candidate.id }),
    })),
  );

describe('a note fix and comment fixes stack in one lane', () => {
  it('keeps a running note fix and a queued comment fix in the same lane of the branch', () => {
    const attempt = (overrides: Partial<ResolveAttempt>): ResolveAttempt => ({
      id: 'a-note',
      sessionId: SESSION_ID,
      agentId: 'agent-note' as AgentId,
      prNumber: null,
      threadIds: [NOTE_THREAD],
      provider: 'anthropic',
      model: 'claude-sonnet-5-5',
      effort: null,
      instructions: null,
      phase: 'running',
      mountTarget: { mountId: MOUNT_ID, mountRevision: 4, worktreePath: '/repo/ledger-core' },
      startedAt: 1,
      endedAt: null,
      error: null,
      createdAt: 1,
      batchId: 'batch-1',
      copyPath: null,
      launchChoice: null,
      ...overrides,
    });
    const note = attempt({});
    const comment = attempt({
      id: 'a-comment',
      agentId: 'agent-comment' as AgentId,
      prNumber: 7,
      threadIds: ['thread-b'],
      phase: 'queued',
      createdAt: 2,
    });
    const attempts = [note, comment];
    const agents = [
      anAgent({
        id: 'agent-note' as AgentId,
        sessionId: SESSION_ID,
        kind: 'resolver',
        status: 'running',
      }),
      anAgent({
        id: 'agent-comment' as AgentId,
        sessionId: SESSION_ID,
        kind: 'resolver',
        status: 'pending',
      }),
    ];

    expect(lanePathsOf({ attempts })).toEqual(['/repo/ledger-core']);
    expect(laneHolderOf({ attempts, agents, worktreePath: '/repo/ledger-core' })?.id).toBe(
      'a-note',
    );
    expect(
      laneQueueOf({ attempts, worktreePath: '/repo/ledger-core' }).map((entry) => entry.id),
    ).toEqual(['a-comment']);
  });

  it('lands both fixes as ready, then accepting the chain closes the note and keeps the comment reply', async () => {
    const live = makeHarness();
    const ids = [NOTE_THREAD, 'thread-b', 'thread-c'];
    await startRun({ harness: live, attemptId: 'run-1', threadIds: ids });
    const shas = [
      commitFile({ name: 'a.txt', body: 'a\n' }),
      commitFile({ name: 'b.txt', body: 'b\n' }),
      commitFile({ name: 'c.txt', body: 'c\n' }),
    ];
    const noteItem = await seedNote({ sha: shas[0] ?? '' });
    const itemB = await seedItem({
      threadId: 'thread-b',
      thread: { disposition: 'fix', commitShas: [shas[1] ?? ''] },
    });
    const itemC = await seedItem({
      threadId: 'thread-c',
      thread: { disposition: 'fix', commitShas: [shas[2] ?? ''] },
    });
    await live.actions.captureResolveCandidate({
      sessionId: SESSION_ID,
      attemptId: 'run-1',
      threadIds: ids,
    });

    const ready = await candidatesWithItems();
    const { chain } = laneChainOf({ candidates: ready, worktreePath });
    expect(chain.map((link) => link.items.map((item) => item.queueItemId))).toEqual([
      [noteItem],
      [itemB],
      [itemC],
    ]);
    const queue = await listResolveQueueItems({ db, sessionId: SESSION_ID });
    const noteItemIds = new Set(
      queue.filter((entry) => entry.thread.originKind === 'diff_comment').map((e) => e.item.id),
    );
    expect(laneAcceptCountOf({ candidates: ready, itemId: itemC })).toBe(3);
    expect(laneAcceptNotesOf({ candidates: ready, itemId: itemC, noteItemIds })).toBe(1);
    expect(
      acceptUpToLabel({
        count: laneAcceptCountOf({ candidates: ready, itemId: itemC }),
        notes: laneAcceptNotesOf({ candidates: ready, itemId: itemC, noteItemIds }),
      }),
    ).toBe('Accept 3 fixes · 1 is a note');

    await live.actions.acceptResolveQueueItem({
      sessionId: SESSION_ID,
      itemId: itemC,
      revision: queue.find((entry) => entry.item.id === itemC)?.item.candidateRevision ?? 0,
      reply: 'Reply for thread-c',
    });

    expect(git(worktreePath, ['rev-parse', 'HEAD'])).toBe(shas[2]);
    const after = await listResolveQueueItems({ db, sessionId: SESSION_ID });
    expect(after.map((entry) => entry.item.approvalState)).toEqual([
      'accepted',
      'accepted',
      'accepted',
    ]);
    const notes = await listDiffCommentsForSession(db, SESSION_ID);
    expect(notes.map((note) => note.status)).toEqual(['resolved']);
    const threads = await listResolveThreads({ db, sessionId: SESSION_ID });
    expect(threads.find((row) => row.threadId === NOTE_THREAD)?.state).toBe('closed');
    expect(threads.find((row) => row.threadId === 'thread-b')?.state).not.toBe('closed');
    expect(threads.find((row) => row.threadId === 'thread-c')?.replyDraft).toBe(
      'Reply for thread-c',
    );
  });
});
