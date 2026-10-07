// @vitest-environment node
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';
import {
  insertResolveAttempt,
  insertResolveQueueItem,
  listResolveAttempts,
  listResolveCandidateItems,
  listResolveCandidates,
  listResolveQueueItems,
  listResolveThreads,
  upsertResolveThread,
  type Database,
} from '@goodboy/db';
import { makeMigratedTestDatabase } from '@goodboy/db/test-helpers';
import type {
  AgentId,
  MountId,
  ProjectId,
  ResolveAttempt,
  ResolveThread,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import { acceptResolveQueueItem } from './acceptResolveQueueItem';
import { integrateWorktreeCandidate } from '../../../features/worktree/worktree';
import { LANE_REBUILD_HINT } from '../../../features/resolve/laneCopy';
import { createResolveSlice } from './index';
import { resolveInitialState } from './state';
import {
  git,
  isAncestor,
  quarantineCandidate,
  revList,
  splitCandidates,
} from './testing/gitWorktree';
import type { GetFn, SetFn } from './types';

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
        const actualHead = git(worktreePath, ['rev-parse', 'HEAD']);
        const journal = journalOf({ worktreePath, candidateId });
        if (existsSync(journal)) {
          const recorded = readFileSync(journal, 'utf8').trim();
          if (recorded !== candidateSha) {
            throw new Error('the integration journal holds a different commit for this candidate');
          }
          if (isAncestor(worktreePath, candidateSha, actualHead)) {
            return candidateSha;
          }
        }
        if (actualHead !== expectedHead) {
          throw new Error(`the branch moved: expected head ${expectedHead}, found ${actualHead}`);
        }
        if (!isAncestor(worktreePath, expectedHead, candidateSha)) {
          throw new Error('the candidate is not based on the expected branch head');
        }
        mkdirSync(dirname(journal), { recursive: true });
        writeFileSync(journal, `${candidateSha}\n`);
        git(worktreePath, ['update-ref', 'HEAD', candidateSha, expectedHead]);
        git(worktreePath, ['reset', '--hard', '--quiet', candidateSha]);
        return candidateSha;
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
  const store = createStore(() => ({
    ...resolveInitialState,
    sessions: [{ id: SESSION_ID, workspaceId: WORKSPACE_ID, activeProjectId: PROJECT_ID }],
    workspaces: [{ id: WORKSPACE_ID }],
    workspaceOverrides: {},
    projects: [{ id: PROJECT_ID, kind: 'repo' }],
    sessionActiveProject: { [SESSION_ID]: PROJECT_ID },
    sessionProjectMounts: {
      [SESSION_ID]: [
        {
          mountId: MOUNT_ID,
          sessionId: SESSION_ID,
          projectId: PROJECT_ID,
          mountName: 'repo',
          worktreePath,
          repoRoot,
          branch: 'feature/fix',
          isAttached: true,
          diskState: 'present',
          revision: 4,
        },
      ],
    },
    sessionGithub: {},
    sessionPhaseRuns: {},
  }));
  const set = store.setState as unknown as SetFn;
  const get = store.getState as unknown as GetFn;
  return { store, set, get, actions: createResolveSlice({ set, get }) };
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

const RESOLVER_ID = 'resolver-1';

type AgentSeed = {
  readonly id: string;
  readonly status: string;
  readonly doneAt: string | null;
};

type ResolverParams = {
  readonly harness: ReturnType<typeof makeHarness>;
  readonly others: ReadonlyArray<AgentSeed>;
  readonly resolverStatus?: string;
};

const withResolver = ({ harness, others, resolverStatus = 'completed' }: ResolverParams) => {
  harness.store.setState({
    sessionPhaseRuns: {
      [SESSION_ID]: [{ id: RESOLVER_ID, status: resolverStatus, doneAt: null }, ...others],
    },
  } as never);
  return harness;
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

type StartParams = {
  readonly harness: ReturnType<typeof makeHarness>;
  readonly attemptId: string;
  readonly createdAt: number;
};

const startAttempt = async ({ harness, attemptId, createdAt }: StartParams): Promise<void> => {
  await insertResolveAttempt({ db, attempt: makeAttempt({ id: attemptId, createdAt }) });
  await harness.actions.beginResolveCandidate({
    sessionId: SESSION_ID,
    attemptId,
    mountTarget: mountTarget(),
  });
};

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

const unapprovedCandidateWorkOnTip = async (): Promise<ReadonlyArray<string>> => {
  const head = git(worktreePath, ['rev-parse', 'HEAD']);
  const entries = await listResolveQueueItems({ db, sessionId: SESSION_ID });
  const approved = new Set(
    entries.flatMap(({ item }) =>
      item.approvalState === 'accepted' && item.integratedSha !== null ? [item.integratedSha] : [],
    ),
  );
  const candidates = await listResolveCandidates({ db, sessionId: SESSION_ID });
  return candidates.flatMap((candidate) => {
    if (candidate.integratedSha !== null && approved.has(candidate.integratedSha)) {
      return [];
    }
    return revList(worktreePath, `${candidate.baseSha}..${candidate.candidateSha}`).filter((sha) =>
      isAncestor(worktreePath, sha, head),
    );
  });
};

const expectNoAncestryLeak = async (): Promise<void> => {
  expect(await unapprovedCandidateWorkOnTip()).toEqual([]);
};

beforeEach(async () => {
  db = await makeMigratedTestDatabase();
  h.exec.mockReset().mockImplementation(db.exec);
  h.execute.mockReset().mockImplementation(db.execute);
  h.select.mockReset().mockImplementation(db.select);
  h.transaction.mockReset().mockImplementation(db.transaction);
  h.leases.clear();
  h.failFinalizeOnce = false;
  h.startBatch.mockClear();
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
}: {
  readonly harness: ReturnType<typeof makeHarness>;
  readonly attemptId: string;
  readonly threadIds: ReadonlyArray<string>;
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

const itemsOfCandidates = async (): Promise<ReadonlyArray<readonly [string, string, string[]]>> => {
  const candidates = await listResolveCandidates({ db, sessionId: SESSION_ID });
  return Promise.all(
    candidates.map(
      async (candidate) =>
        [
          candidate.id,
          candidate.state,
          (await listResolveCandidateItems({ db, candidateId: candidate.id })).map(
            (item) => item.queueItemId,
          ),
        ] as const as readonly [string, string, string[]],
    ),
  );
};

describe('one candidate for each comment of a run', () => {
  it('splits the fixes of one run into a chain, each candidate stacked on the one before', async () => {
    const live = makeHarness();
    const ids = ['thread-a', 'thread-b', 'thread-c'];
    await startRun({ harness: live, attemptId: 'run-1', threadIds: ids });
    const shas = [
      commitFile({ name: 'a.txt', body: 'a\n' }),
      commitFile({ name: 'b.txt', body: 'b\n' }),
      commitFile({ name: 'c.txt', body: 'c\n' }),
    ];
    for (const [index, threadId] of ids.entries()) {
      await seedItem({
        threadId,
        thread: { disposition: 'fix', commitShas: [shas[index] ?? ''] },
      });
    }

    await live.actions.captureResolveCandidate({
      sessionId: SESSION_ID,
      attemptId: 'run-1',
      threadIds: ids,
    });

    expect(await itemsOfCandidates()).toEqual([
      ['run-1', 'discarded', []],
      ['run-1-1', 'ready', ['item-thread-a']],
      ['run-1-2', 'ready', ['item-thread-b']],
      ['run-1-3', 'ready', ['item-thread-c']],
    ]);
    const candidates = (await listResolveCandidates({ db, sessionId: SESSION_ID })).filter(
      (item) => item.state === 'ready',
    );
    expect(candidates.map((candidate) => candidate.baseSha)).toEqual([rootSha, shas[0], shas[1]]);
    expect(candidates.map((candidate) => candidate.candidateSha)).toEqual(shas);
    const threads = await listResolveThreads({ db, sessionId: SESSION_ID });
    expect(threads.find((row) => row.threadId === 'thread-c')?.commitShas).toEqual([shas[2]]);
    expect(git(worktreePath, ['rev-parse', 'HEAD'])).toBe(rootSha);
    expect(git(agentCwd, ['rev-parse', 'HEAD'])).toBe(shas[2]);
  });

  it('accepts the fixes before a comment together with it, in order, and leaves the later ones', async () => {
    const live = makeHarness();
    const ids = ['thread-a', 'thread-b', 'thread-c'];
    await startRun({ harness: live, attemptId: 'run-1', threadIds: ids });
    const shas = [
      commitFile({ name: 'a.txt', body: 'a\n' }),
      commitFile({ name: 'b.txt', body: 'b\n' }),
      commitFile({ name: 'c.txt', body: 'c\n' }),
    ];
    const items: string[] = [];
    for (const [index, threadId] of ids.entries()) {
      items.push(
        await seedItem({
          threadId,
          thread: { disposition: 'fix', commitShas: [shas[index] ?? ''] },
        }),
      );
    }
    await live.actions.captureResolveCandidate({
      sessionId: SESSION_ID,
      attemptId: 'run-1',
      threadIds: ids,
    });
    const itemB = items[1] ?? '';
    const revision =
      (await listResolveQueueItems({ db, sessionId: SESSION_ID })).find(
        (entry) => entry.item.id === itemB,
      )?.item.candidateRevision ?? 0;

    await live.actions.acceptResolveQueueItem({
      sessionId: SESSION_ID,
      itemId: itemB,
      revision,
      reply: 'Reply for thread-b',
    });

    expect(git(worktreePath, ['rev-parse', 'HEAD'])).toBe(shas[1]);
    expect(existsSync(join(worktreePath, 'a.txt'))).toBe(true);
    expect(existsSync(join(worktreePath, 'b.txt'))).toBe(true);
    expect(existsSync(join(worktreePath, 'c.txt'))).toBe(false);
    const states = await listResolveQueueItems({ db, sessionId: SESSION_ID });
    expect(states.map((entry) => [entry.item.id, entry.item.approvalState])).toEqual([
      ['item-thread-a', 'accepted'],
      ['item-thread-b', 'accepted'],
      ['item-thread-c', 'none'],
    ]);
    expect(states.map((entry) => entry.item.integratedSha)).toEqual([shas[0], shas[1], null]);
    expect(await itemsOfCandidates()).toEqual([
      ['run-1', 'discarded', []],
      ['run-1-1', 'integrated', ['item-thread-a']],
      ['run-1-2', 'integrated', ['item-thread-b']],
      ['run-1-3', 'ready', ['item-thread-c']],
    ]);
  });

  it('chains a fix that builds on an earlier one instead of sharing a candidate', async () => {
    const live = makeHarness();
    const ids = ['thread-a', 'thread-b'];
    await startRun({ harness: live, attemptId: 'run-1', threadIds: ids });
    const shas = [
      commitFile({ name: 'shared.txt', body: 'one\n' }),
      commitFile({ name: 'shared.txt', body: 'two\n' }),
    ];
    for (const [index, threadId] of ids.entries()) {
      await seedItem({
        threadId,
        thread: { disposition: 'fix', commitShas: [shas[index] ?? ''] },
      });
    }

    await live.actions.captureResolveCandidate({
      sessionId: SESSION_ID,
      attemptId: 'run-1',
      threadIds: ids,
    });

    expect(await itemsOfCandidates()).toEqual([
      ['run-1', 'discarded', []],
      ['run-1-1', 'ready', ['item-thread-a']],
      ['run-1-2', 'ready', ['item-thread-b']],
    ]);
    expect(git(worktreePath, ['rev-parse', 'HEAD'])).toBe(rootSha);
  });

  it('keeps one shared candidate when a commit of the run belongs to no comment', async () => {
    const live = makeHarness();
    const ids = ['thread-a', 'thread-b'];
    await startRun({ harness: live, attemptId: 'run-1', threadIds: ids });
    const shas = [
      commitFile({ name: 'a.txt', body: 'a\n' }),
      commitFile({ name: 'lint.txt', body: 'lint\n' }),
      commitFile({ name: 'b.txt', body: 'b\n' }),
    ];
    await seedItem({
      threadId: 'thread-a',
      thread: { disposition: 'fix', commitShas: [shas[0] ?? ''] },
    });
    await seedItem({
      threadId: 'thread-b',
      thread: { disposition: 'fix', commitShas: [shas[2] ?? ''] },
    });

    await live.actions.captureResolveCandidate({
      sessionId: SESSION_ID,
      attemptId: 'run-1',
      threadIds: ids,
    });

    expect(await itemsOfCandidates()).toEqual([
      ['run-1', 'ready', ['item-thread-a', 'item-thread-b']],
    ]);
    expect(git(agentCwd, ['rev-parse', 'HEAD'])).toBe(shas[2]);
  });

  it('starts the next run of a lane on the tip the last candidate left in the copy', async () => {
    const live = makeHarness();
    await startRun({ harness: live, attemptId: 'run-1', threadIds: ['thread-a'] });
    const first = commitFile({ name: 'a.txt', body: 'a\n' });
    await seedItem({ threadId: 'thread-a', thread: { disposition: 'fix', commitShas: [first] } });
    await live.actions.captureResolveCandidate({
      sessionId: SESSION_ID,
      attemptId: 'run-1',
      threadIds: ['thread-a'],
    });
    await insertResolveAttempt({
      db,
      attempt: {
        ...makeAttempt({ id: 'run-2', createdAt: 20 }),
        threadIds: ['thread-b'],
        phase: 'running',
        error: null,
        copyPath: agentCwd,
      },
    });
    await live.actions.beginResolveCandidate({
      sessionId: SESSION_ID,
      attemptId: 'run-2',
      mountTarget: mountTarget(),
      baseSha: git(agentCwd, ['rev-parse', 'HEAD']),
    });
    const second = commitFile({ name: 'b.txt', body: 'b\n' });
    await seedItem({ threadId: 'thread-b', thread: { disposition: 'fix', commitShas: [second] } });

    await live.actions.captureResolveCandidate({
      sessionId: SESSION_ID,
      attemptId: 'run-2',
      threadIds: ['thread-b'],
    });

    const [one, two] = (await listResolveCandidates({ db, sessionId: SESSION_ID })).filter(
      (candidate) => candidate.state === 'ready',
    );
    expect(one?.candidateSha).toBe(first);
    expect(two?.baseSha).toBe(first);
    expect(two?.candidateSha).toBe(second);
  });

  it('ties only the fixes to the code, so a reply-only comment is accepted without landing it', async () => {
    const live = makeHarness();
    const ids = ['thread-a', 'thread-b', 'thread-c'];
    await startRun({ harness: live, attemptId: 'run-1', threadIds: ids });
    const sha = commitFile({ name: 'a.txt', body: 'a\n' });
    const items = [
      await seedItem({ threadId: 'thread-a', thread: { disposition: 'fix', commitShas: [sha] } }),
      await seedItem({ threadId: 'thread-b', thread: { disposition: 'no_change' } }),
      await seedItem({ threadId: 'thread-c', thread: { disposition: 'no_change' } }),
    ];

    await live.actions.captureResolveCandidate({
      sessionId: SESSION_ID,
      attemptId: 'run-1',
      threadIds: ids,
    });
    expect(await itemsOfCandidates()).toEqual([['run-1', 'ready', [items[0] ?? '']]]);

    const replyItem = items[1] ?? '';
    const revision =
      (await listResolveQueueItems({ db, sessionId: SESSION_ID })).find(
        (entry) => entry.item.id === replyItem,
      )?.item.candidateRevision ?? 0;
    await live.actions.acceptResolveQueueItem({
      sessionId: SESSION_ID,
      itemId: replyItem,
      revision,
      reply: 'Reply for thread-b',
    });

    expect(existsSync(join(worktreePath, 'a.txt'))).toBe(false);
    expect(git(worktreePath, ['rev-parse', 'HEAD'])).toBe(rootSha);
    expect((await itemsOfCandidates())[0]?.[1]).toBe('ready');
  });

  it('does not split a run with a single fix', async () => {
    const live = makeHarness();
    await startRun({ harness: live, attemptId: 'run-1', threadIds: ['thread-a'] });
    const sha = commitFile({ name: 'a.txt', body: 'a\n' });
    await seedItem({ threadId: 'thread-a', thread: { disposition: 'fix', commitShas: [sha] } });

    await live.actions.captureResolveCandidate({
      sessionId: SESSION_ID,
      attemptId: 'run-1',
      threadIds: ['thread-a'],
    });

    expect(await itemsOfCandidates()).toEqual([['run-1', 'ready', ['item-thread-a']]]);
  });
});

describe('resolve candidates keep the branch tip approved', () => {
  it('refuses to accept one comment when the same candidate answers a deferred one', async () => {
    const live = makeHarness();
    const itemA = await seedItem({ threadId: 'thread-a' });
    const itemB = await seedItem({ threadId: 'thread-b' });
    await live.actions.beginResolveCandidate({
      sessionId: SESSION_ID,
      attemptId: 'attempt-1',
      mountTarget: mountTarget(),
    });
    agentWrites({
      files: [
        ['a.txt', 'a\n'],
        ['b.txt', 'b\n'],
      ],
      message: 'fix both comments',
    });
    const candidateSha = await live.actions.captureResolveCandidate({
      sessionId: SESSION_ID,
      attemptId: 'attempt-1',
      threadIds: ['thread-a', 'thread-b'],
    });

    expect(candidateSha).not.toBeNull();
    expect(git(worktreePath, ['rev-parse', 'HEAD'])).toBe(rootSha);
    await live.actions.deferResolveQueueItem({ sessionId: SESSION_ID, itemId: itemB });

    await expect(
      live.actions.acceptResolveQueueItem({
        sessionId: SESSION_ID,
        itemId: itemA,
        revision: 0,
        reply: 'Reply for thread-a',
      }),
    ).rejects.toThrow('left for later');

    expect(git(worktreePath, ['rev-parse', 'HEAD'])).toBe(rootSha);
    expect(existsSync(join(worktreePath, 'b.txt'))).toBe(false);
    await expectNoAncestryLeak();
  });

  it('accepts a candidate that answers several comments as one decision', async () => {
    const live = makeHarness();
    const itemA = await seedItem({ threadId: 'thread-a' });
    const itemB = await seedItem({ threadId: 'thread-b' });
    await live.actions.beginResolveCandidate({
      sessionId: SESSION_ID,
      attemptId: 'attempt-1',
      mountTarget: mountTarget(),
    });
    agentWrites({
      files: [
        ['a.txt', 'a\n'],
        ['b.txt', 'b\n'],
      ],
      message: 'fix both comments',
    });
    const candidateSha = await live.actions.captureResolveCandidate({
      sessionId: SESSION_ID,
      attemptId: 'attempt-1',
      threadIds: ['thread-a', 'thread-b'],
    });

    await live.actions.acceptResolveQueueItem({
      sessionId: SESSION_ID,
      itemId: itemA,
      revision: 0,
      reply: 'Reply for thread-a',
    });

    const entries = await listResolveQueueItems({ db, sessionId: SESSION_ID });
    for (const itemId of [itemA, itemB]) {
      expect(entries.find((entry) => entry.item.id === itemId)?.item).toMatchObject({
        approvalState: 'accepted',
        approvedRevision: 0,
        integratedSha: candidateSha,
      });
    }
    expect(git(worktreePath, ['rev-parse', 'HEAD'])).toBe(candidateSha);
    expect(revList(worktreePath, `${rootSha}..HEAD`)).toHaveLength(1);
    await expectNoAncestryLeak();
  });

  it('refuses to defer work that is already on the branch', async () => {
    const live = makeHarness();
    const itemA = await seedItem({ threadId: 'thread-a' });
    await live.actions.beginResolveCandidate({
      sessionId: SESSION_ID,
      attemptId: 'attempt-1',
      mountTarget: mountTarget(),
    });
    agentWrites({ files: [['a.txt', 'a\n']], message: 'fix a' });
    await live.actions.captureResolveCandidate({
      sessionId: SESSION_ID,
      attemptId: 'attempt-1',
      threadIds: ['thread-a'],
    });
    await live.actions.acceptResolveQueueItem({
      sessionId: SESSION_ID,
      itemId: itemA,
      revision: 0,
      reply: 'Reply for thread-a',
    });

    await expect(
      live.actions.deferResolveQueueItem({ sessionId: SESSION_ID, itemId: itemA }),
    ).rejects.toThrow('already on the branch');
    await expectNoAncestryLeak();
  });

  it('lets a single candidate through when two race for the writer lock', async () => {
    const live = makeHarness();
    const itemA = await seedItem({ threadId: 'thread-a' });
    const itemB = await seedItem({ threadId: 'thread-b' });
    await live.actions.beginResolveCandidate({
      sessionId: SESSION_ID,
      attemptId: 'attempt-a',
      mountTarget: mountTarget(),
    });
    agentWrites({ files: [['a.txt', 'a\n']], message: 'fix a' });
    await live.actions.captureResolveCandidate({
      sessionId: SESSION_ID,
      attemptId: 'attempt-a',
      threadIds: ['thread-a'],
    });
    await live.actions.beginResolveCandidate({
      sessionId: SESSION_ID,
      attemptId: 'attempt-b',
      mountTarget: mountTarget(),
    });
    agentWrites({ files: [['b.txt', 'b\n']], message: 'fix b' });
    await live.actions.captureResolveCandidate({
      sessionId: SESSION_ID,
      attemptId: 'attempt-b',
      threadIds: ['thread-b'],
    });

    const outcomes = await Promise.allSettled([
      acceptResolveQueueItem({
        set: live.set,
        get: live.get,
        sessionId: SESSION_ID,
        itemId: itemA,
        revision: 0,
        reply: 'Reply for thread-a',
      }),
      acceptResolveQueueItem({
        set: live.set,
        get: live.get,
        sessionId: SESSION_ID,
        itemId: itemB,
        revision: 0,
        reply: 'Reply for thread-b',
      }),
    ]);

    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    const rejected = outcomes.find((outcome) => outcome.status === 'rejected');
    expect(String(rejected?.status === 'rejected' ? rejected.reason : '')).toContain(
      'the branch moved',
    );
    expect(revList(worktreePath, `${rootSha}..HEAD`)).toHaveLength(1);
    await expectNoAncestryLeak();
  });

  it('refuses to integrate when an external commit moved the head', async () => {
    const live = makeHarness();
    const itemA = await seedItem({ threadId: 'thread-a' });
    await live.actions.beginResolveCandidate({
      sessionId: SESSION_ID,
      attemptId: 'attempt-1',
      mountTarget: mountTarget(),
    });
    agentWrites({ files: [['a.txt', 'a\n']], message: 'fix a' });
    const candidateSha = await live.actions.captureResolveCandidate({
      sessionId: SESSION_ID,
      attemptId: 'attempt-1',
      threadIds: ['thread-a'],
    });
    agentWrites({ files: [['unrelated.txt', 'x\n']], message: 'someone else commits' });
    const external = git(worktreePath, ['rev-parse', 'HEAD']);

    await expect(
      live.actions.acceptResolveQueueItem({
        sessionId: SESSION_ID,
        itemId: itemA,
        revision: 0,
        reply: 'Reply for thread-a',
      }),
    ).rejects.toThrow('the branch moved');

    expect(git(worktreePath, ['rev-parse', 'HEAD'])).toBe(external);
    expect(isAncestor(worktreePath, candidateSha ?? '', external)).toBe(false);
    expect(
      (await listResolveQueueItems({ db, sessionId: SESSION_ID })).find(
        (entry) => entry.item.id === itemA,
      )?.item.approvalState,
    ).toBe('none');
    await expectNoAncestryLeak();
  });

  it('rolls a fix back at accept when the branch moved under it and tells the comment to fix it again', async () => {
    const live = makeHarness();
    const itemA = await seedItem({ threadId: 'thread-a' });
    await startAttempt({ harness: live, attemptId: 'attempt-1', createdAt: 10 });
    agentWrites({ files: [['a.txt', 'a\n']], message: 'fix a' });
    await live.actions.captureResolveCandidate({
      sessionId: SESSION_ID,
      attemptId: 'attempt-1',
      threadIds: ['thread-a'],
    });
    const head = git(worktreePath, ['rev-parse', 'HEAD']);
    vi.mocked(integrateWorktreeCandidate).mockRejectedValueOnce({
      kind: 'git',
      message: 'git failed: the fix no longer applies on the branch',
    });

    await expect(
      live.actions.acceptResolveQueueItem({
        sessionId: SESSION_ID,
        itemId: itemA,
        revision: 0,
        reply: 'Reply for thread-a',
      }),
    ).rejects.toThrow('The branch moved under this fix');

    expect(git(worktreePath, ['rev-parse', 'HEAD'])).toBe(head);
    const [thread] = await listResolveThreads({ db, sessionId: SESSION_ID });
    expect(thread?.state).toBe('failed');
    const attempts = await listResolveAttempts({ db, sessionId: SESSION_ID });
    expect(attempts.find((attempt) => attempt.id === 'attempt-1')?.failureCause).toBe(
      'accept_conflict',
    );
    const [candidate] = await listResolveCandidates({ db, sessionId: SESSION_ID });
    expect(candidate?.state).toBe('stale');
  });

  it('recovers from a crash between the git operation and the database write', async () => {
    const live = makeHarness();
    const itemA = await seedItem({ threadId: 'thread-a' });
    await live.actions.beginResolveCandidate({
      sessionId: SESSION_ID,
      attemptId: 'attempt-1',
      mountTarget: mountTarget(),
    });
    agentWrites({ files: [['a.txt', 'a\n']], message: 'fix a' });
    const candidateSha = await live.actions.captureResolveCandidate({
      sessionId: SESSION_ID,
      attemptId: 'attempt-1',
      threadIds: ['thread-a'],
    });
    h.failFinalizeOnce = true;

    await expect(
      live.actions.acceptResolveQueueItem({
        sessionId: SESSION_ID,
        itemId: itemA,
        revision: 0,
        reply: 'Reply for thread-a',
      }),
    ).rejects.toThrow('the database is locked');

    expect(git(worktreePath, ['rev-parse', 'HEAD'])).toBe(candidateSha);
    expect(
      (await listResolveQueueItems({ db, sessionId: SESSION_ID })).find(
        (entry) => entry.item.id === itemA,
      )?.item.integratedSha,
    ).toBeNull();

    await live.actions.acceptResolveQueueItem({
      sessionId: SESSION_ID,
      itemId: itemA,
      revision: 0,
      reply: 'Reply for thread-a',
    });

    expect(git(worktreePath, ['rev-parse', 'HEAD'])).toBe(candidateSha);
    expect(revList(worktreePath, `${rootSha}..HEAD`)).toHaveLength(1);
    expect(
      (await listResolveQueueItems({ db, sessionId: SESSION_ID })).find(
        (entry) => entry.item.id === itemA,
      )?.item.integratedSha,
    ).toBe(candidateSha);
    await expectNoAncestryLeak();
  });

  it('marks an approval as changed when the comment moves under an accepted candidate', async () => {
    const live = makeHarness();
    const itemA = await seedItem({ threadId: 'thread-a' });
    await live.actions.beginResolveCandidate({
      sessionId: SESSION_ID,
      attemptId: 'attempt-1',
      mountTarget: mountTarget(),
    });
    agentWrites({ files: [['a.txt', 'a\n']], message: 'fix a' });
    await live.actions.captureResolveCandidate({
      sessionId: SESSION_ID,
      attemptId: 'attempt-1',
      threadIds: ['thread-a'],
    });
    await live.actions.acceptResolveQueueItem({
      sessionId: SESSION_ID,
      itemId: itemA,
      revision: 0,
      reply: 'Reply for thread-a',
    });
    const accepted = git(worktreePath, ['rev-parse', 'HEAD']);

    await live.actions.updateResolveThread({
      sessionId: SESSION_ID,
      threadId: 'thread-a',
      patch: { replyDraft: 'A second look at the same file' },
    });

    const entry = (await listResolveQueueItems({ db, sessionId: SESSION_ID })).find(
      (row) => row.item.id === itemA,
    );
    expect(entry).toBeDefined();
    expect(entry!.thread.revision).toBeGreaterThan(entry!.item.approvedRevision ?? -1);
    expect(entry!.thread.stage).toBe('proposed');

    await expect(
      live.actions.acceptResolveQueueItem({
        sessionId: SESSION_ID,
        itemId: itemA,
        revision: 0,
        reply: 'Reply for thread-a',
      }),
    ).rejects.toThrow('This answer changed since you opened it. Review it again.');
    expect(git(worktreePath, ['rev-parse', 'HEAD'])).toBe(accepted);
    await expectNoAncestryLeak();
  });

  it('parks work the crash left on the branch when the run is loaded again', async () => {
    const crashed = makeHarness();
    const itemA = await seedItem({ threadId: 'thread-a' });
    await crashed.actions.beginResolveCandidate({
      sessionId: SESSION_ID,
      attemptId: 'attempt-1',
      mountTarget: mountTarget(),
    });
    agentWrites({ files: [['a.txt', 'a\n']], message: 'fix a' });
    const uncaptured = git(worktreePath, ['rev-parse', 'HEAD']);
    expect(uncaptured).not.toBe(rootSha);

    const relaunched = makeHarness();
    const pending = await relaunched.actions.recoverUncapturedResolveWork({
      sessionId: SESSION_ID,
    });

    expect(pending).toBeNull();
    expect(git(worktreePath, ['rev-parse', 'HEAD'])).toBe(rootSha);
    expect(existsSync(join(worktreePath, 'a.txt'))).toBe(false);
    expect(git(worktreePath, ['rev-parse', 'refs/goodboy/candidates/attempt-1'])).toBe(uncaptured);
    expect((await listResolveCandidates({ db, sessionId: SESSION_ID }))[0]).toMatchObject({
      state: 'ready',
      candidateSha: uncaptured,
    });
    expect(
      (await listResolveQueueItems({ db, sessionId: SESSION_ID })).find(
        (entry) => entry.item.id === itemA,
      )?.item.approvalState,
    ).toBe('none');
    await expectNoAncestryLeak();
  });

  it('keeps a finished resolver commits on the branch once no workflow is live', async () => {
    const live = withResolver({ harness: makeHarness(), others: [] });
    await seedItem({ threadId: 'thread-a' });
    await startAttempt({ harness: live, attemptId: 'attempt-1', createdAt: 10 });
    agentWrites({ files: [['a.txt', 'a\n']], message: 'redo the fix the user asked for' });
    const applied = git(worktreePath, ['rev-parse', 'HEAD']);

    const pending = await live.actions.recoverUncapturedResolveWork({ sessionId: SESSION_ID });

    expect(pending).toBeNull();
    expect(git(worktreePath, ['rev-parse', 'HEAD'])).toBe(applied);
    expect((await listResolveCandidates({ db, sessionId: SESSION_ID }))[0]?.state).toBe(
      'discarded',
    );
  });

  it('still parks a finished resolver proposal while a workflow agent writes the branch', async () => {
    const live = withResolver({
      harness: makeHarness(),
      others: [{ id: 'implementer', status: 'running', doneAt: null }],
    });
    await seedItem({ threadId: 'thread-a' });
    await startAttempt({ harness: live, attemptId: 'attempt-1', createdAt: 10 });
    agentWrites({ files: [['a.txt', 'a\n']], message: 'propose a fix' });

    await live.actions.recoverUncapturedResolveWork({ sessionId: SESSION_ID });

    expect(git(worktreePath, ['rev-parse', 'HEAD'])).toBe(rootSha);
    expect((await listResolveCandidates({ db, sessionId: SESSION_ID }))[0]?.state).toBe('ready');
  });

  it('never parks the work of a resolver turn that is still running', async () => {
    const live = withResolver({
      harness: makeHarness(),
      others: [{ id: 'implementer', status: 'running', doneAt: null }],
      resolverStatus: 'running',
    });
    live.store.setState({ agentTurnState: { [RESOLVER_ID]: { kind: 'running' } } } as never);
    await seedItem({ threadId: 'thread-a' });
    await startAttempt({ harness: live, attemptId: 'attempt-1', createdAt: 10 });
    agentWrites({ files: [['a.txt', 'a\n']], message: 'mid-turn commit' });
    const inFlight = git(worktreePath, ['rev-parse', 'HEAD']);

    await live.actions.recoverUncapturedResolveWork({ sessionId: SESSION_ID });

    expect(git(worktreePath, ['rev-parse', 'HEAD'])).toBe(inFlight);
    expect((await listResolveCandidates({ db, sessionId: SESSION_ID }))[0]?.state).toBe('building');
  });

  it('never resets commits a later turn made on top of an older proposal', async () => {
    const live = withResolver({
      harness: makeHarness(),
      others: [{ id: 'implementer', status: 'running', doneAt: null }],
    });
    await seedItem({ threadId: 'thread-a' });
    await startAttempt({ harness: live, attemptId: 'attempt-1', createdAt: 10 });
    agentWrites({ files: [['a.txt', 'a\n']], message: 'interrupted proposal' });
    await insertResolveAttempt({ db, attempt: makeAttempt({ id: 'attempt-2', createdAt: 20 }) });
    agentWrites({ files: [['b.txt', 'b\n']], message: 'the user asked for this' });
    const later = git(worktreePath, ['rev-parse', 'HEAD']);

    await live.actions.recoverUncapturedResolveWork({ sessionId: SESSION_ID });

    expect(git(worktreePath, ['rev-parse', 'HEAD'])).toBe(later);
    expect((await listResolveCandidates({ db, sessionId: SESSION_ID }))[0]?.state).toBe(
      'discarded',
    );
  });

  it('leaves the branch alone when no queued comment covers the captured work', async () => {
    const live = makeHarness();
    await live.actions.beginResolveCandidate({
      sessionId: SESSION_ID,
      attemptId: 'attempt-1',
      mountTarget: mountTarget(),
    });
    agentWrites({ files: [['a.txt', 'a\n']], message: 'follow-up the user asked for' });
    const applied = git(worktreePath, ['rev-parse', 'HEAD']);

    const candidateSha = await live.actions.captureResolveCandidate({
      sessionId: SESSION_ID,
      attemptId: 'attempt-1',
      threadIds: ['thread-a'],
    });

    expect(candidateSha).toBeNull();
    expect(git(worktreePath, ['rev-parse', 'HEAD'])).toBe(applied);
    expect((await listResolveCandidates({ db, sessionId: SESSION_ID }))[0]?.state).toBe(
      'discarded',
    );
  });

  it('refuses integration and publication while uncaptured work cannot be parked', async () => {
    const live = makeHarness();
    const itemA = await seedItem({ threadId: 'thread-a' });
    await live.actions.beginResolveCandidate({
      sessionId: SESSION_ID,
      attemptId: 'attempt-1',
      mountTarget: mountTarget(),
    });
    agentWrites({ files: [['a.txt', 'a\n']], message: 'fix a' });
    await live.actions.captureResolveCandidate({
      sessionId: SESSION_ID,
      attemptId: 'attempt-1',
      threadIds: ['thread-a'],
    });
    await live.actions.beginResolveCandidate({
      sessionId: SESSION_ID,
      attemptId: 'attempt-2',
      mountTarget: mountTarget(),
    });
    agentWrites({ files: [['b.txt', 'b\n']], message: 'fix b, then the app dies' });
    const stranded = git(worktreePath, ['rev-parse', 'HEAD']);
    h.leases.set(worktreePath, 'someone-else');

    const pending = await live.actions.recoverUncapturedResolveWork({ sessionId: SESSION_ID });

    expect(pending).toMatchObject({ candidateId: 'attempt-2', reason: 'quarantine_failed' });
    expect(live.store.getState().sessionResolveUncapturedWork[SESSION_ID]).toEqual(pending);
    await expect(
      live.actions.acceptResolveQueueItem({
        sessionId: SESSION_ID,
        itemId: itemA,
        revision: 0,
        reply: 'Reply for thread-a',
      }),
    ).rejects.toThrow('never captured');
    expect(git(worktreePath, ['rev-parse', 'HEAD'])).toBe(stranded);

    const preview = await live.actions.preparePublication({ sessionId: SESSION_ID });

    expect(preview.blocker).toBe('uncaptured_work');
    expect(preview.publicationId).toBeNull();
  });
});

const seedChain = async ({
  live,
  ids,
}: {
  readonly live: ReturnType<typeof makeHarness>;
  readonly ids: ReadonlyArray<string>;
}): Promise<ReadonlyArray<string>> => {
  await startRun({ harness: live, attemptId: 'run-1', threadIds: [...ids] });
  const shas = ids.map((threadId) =>
    commitFile({ name: `${threadId}.txt`, body: `${threadId}\n` }),
  );
  for (const [index, threadId] of ids.entries()) {
    await seedItem({ threadId, thread: { disposition: 'fix', commitShas: [shas[index] ?? ''] } });
  }
  await live.actions.captureResolveCandidate({
    sessionId: SESSION_ID,
    attemptId: 'run-1',
    threadIds: [...ids],
  });
  return shas;
};

const readyCandidateIds = async (): Promise<ReadonlyArray<string>> =>
  (await listResolveCandidates({ db, sessionId: SESSION_ID }))
    .filter((candidate) => candidate.state === 'ready')
    .map((candidate) => candidate.id);

describe('a lane keeps one chain of fixes on a branch', () => {
  it('drops a refused middle fix and has the lane rebuild the ones after it', async () => {
    const live = makeHarness();
    const ids = ['thread-a', 'thread-b', 'thread-c', 'thread-d'];
    await seedChain({ live, ids });
    const revision =
      (await listResolveQueueItems({ db, sessionId: SESSION_ID })).find(
        (entry) => entry.item.id === 'item-thread-b',
      )?.item.candidateRevision ?? 0;

    await live.actions.refuseResolveQueueItem({
      sessionId: SESSION_ID,
      itemId: 'item-thread-b',
      revision,
      reply: 'No, this stays as it is',
    });

    expect(await readyCandidateIds()).toEqual(['run-1-1']);
    expect(h.startBatch).toHaveBeenCalledTimes(1);
    expect(h.startBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: SESSION_ID,
        threadIds: ['thread-c', 'thread-d'],
        launchChoice: expect.objectContaining({
          hint: expect.stringContaining(LANE_REBUILD_HINT),
        }),
      }),
    );
    const states = await listResolveQueueItems({ db, sessionId: SESSION_ID });
    expect(states.map((entry) => [entry.item.id, entry.item.approvalState])).toEqual([
      ['item-thread-a', 'none'],
      ['item-thread-b', 'wont_fix'],
      ['item-thread-c', 'none'],
      ['item-thread-d', 'none'],
    ]);
  });

  it('keeps the first of fixes built side by side and queues the others to be rebuilt', async () => {
    const live = makeHarness();
    const ids = ['thread-a', 'thread-b', 'thread-c', 'thread-d'];
    for (const [index, threadId] of ids.entries()) {
      await seedItem({ threadId, thread: { disposition: 'fix', commitShas: [`sha-${index}`] } });
      await db.execute(
        `INSERT INTO resolve_candidates (id, session_id, revision, base_sha, candidate_sha, worktree_path, state, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'ready', 1, 1)`,
        [`sibling-${index}`, SESSION_ID, index + 1, rootSha, `sha-${index}`, worktreePath],
      );
      await db.execute(
        'INSERT INTO resolve_candidate_items (candidate_id, queue_item_id, item_revision) VALUES (?, ?, 0)',
        [`sibling-${index}`, `item-${threadId}`],
      );
    }

    await live.actions.reconcileResolveLane({ sessionId: SESSION_ID });

    expect(await readyCandidateIds()).toEqual(['sibling-0']);
    expect(h.startBatch).toHaveBeenCalledTimes(1);
    expect(h.startBatch).toHaveBeenCalledWith(
      expect.objectContaining({ threadIds: ['thread-b', 'thread-c', 'thread-d'] }),
    );
    const states = await listResolveQueueItems({ db, sessionId: SESSION_ID });
    expect(states.every((entry) => entry.item.approvalState === 'none')).toBe(true);
  });

  it('leaves a lane that is already one chain alone', async () => {
    const live = makeHarness();
    await seedChain({ live, ids: ['thread-a', 'thread-b'] });

    await live.actions.reconcileResolveLane({ sessionId: SESSION_ID });

    expect(await readyCandidateIds()).toEqual(['run-1-1', 'run-1-2']);
    expect(h.startBatch).not.toHaveBeenCalled();
  });

  it('refuses to accept a fix whose earlier fix was set aside, and leaves the branch alone', async () => {
    const live = makeHarness();
    const ids = ['thread-a', 'thread-b'];
    await seedChain({ live, ids });
    await live.actions.deferResolveQueueItem({ sessionId: SESSION_ID, itemId: 'item-thread-a' });
    const revision =
      (await listResolveQueueItems({ db, sessionId: SESSION_ID })).find(
        (entry) => entry.item.id === 'item-thread-b',
      )?.item.candidateRevision ?? 0;

    await expect(
      live.actions.acceptResolveQueueItem({
        sessionId: SESSION_ID,
        itemId: 'item-thread-b',
        revision,
        reply: 'Reply for thread-b',
      }),
    ).rejects.toThrow();

    expect(git(worktreePath, ['rev-parse', 'HEAD'])).toBe(rootSha);
  });
});
