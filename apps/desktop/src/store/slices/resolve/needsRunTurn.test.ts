import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  insertAgent,
  insertMessage,
  insertSession,
  insertWorkspace,
  listResolveAttempts,
  listResolveQueueItems,
  listResolveThreads,
} from '@goodboy/db';
import { brandId, type MessageId, type MountId } from '@goodboy/types';
import { aSession, aWorkspace, anAgent, TEST_NOW } from '@goodboy/types/testing';
import {
  importStore,
  openStorySqlite,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  storySqlite,
  type StoryStore,
} from '../../storyHarness';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).sqliteDbLibModuleMock(),
);
vi.mock('../../../features/chat/turn', async () =>
  (await import('../../storyHarness')).turnModuleMock(),
);
vi.mock('../../../features/worktree/worktree', async () =>
  (await import('../../storyHarness')).worktreeModuleMock(),
);
vi.mock('../../../shared/lib/repo', async () =>
  (await import('../../storyHarness')).repoModuleMock(),
);

const workspace = aWorkspace({ name: 'Harborline', slug: 'harborline' });
const session = aSession({ workspaceId: workspace.id, goal: 'Ledger layout' });
const resolver = anAgent({
  sessionId: session.id,
  name: 'resolver',
  kind: 'resolver',
  status: 'completed',
  sourceThreadIds: ['PRRT_1', 'PRRT_2'],
  sourceCommentUrl: 'https://github.com/harborline/payments-api/pull/12#discussion_r1',
});
const MOUNT_TARGET = {
  mountId: brandId<MountId>({ value: 'mount-payments-api' }),
  mountRevision: 2,
  worktreePath: '/repos/payments-api/.goodboy/worktrees/one',
};
const FOUND = 'It touches the ledger layout, the payouts route and two new components.';

let store: StoryStore;

const startAttempt = async (): Promise<string> => {
  await store.getState().loadResolveSession({ sessionId: session.id });
  return store.getState().recordResolveAttempt({
    sessionId: session.id,
    agent: resolver,
    provider: 'anthropic',
    model: 'model',
    effort: null,
    instructions: null,
    phase: 'running',
    mountTarget: MOUNT_TARGET,
  });
};

type TurnParams = {
  readonly attemptId: string;
  readonly assistantText: string;
};

const endTurn = ({ attemptId, assistantText }: TurnParams) =>
  store.getState().persistResolveTurn({
    sessionId: session.id,
    agent: resolver,
    attemptId,
    assistantText,
  });

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  const db = await openStorySqlite();
  await insertWorkspace({ db, workspace });
  await insertSession(db, session);
  await insertAgent(db, {
    id: resolver.id,
    sessionId: session.id,
    ordinal: 0,
    name: 'resolver',
    status: 'completed',
  });
  store.setState({ sessionPhaseRuns: { [session.id]: [resolver] } });
});

describe('a fixer that says a comment needs a run', () => {
  it('marks only that thread, keeps the fix of the other, and queues only the fix', async () => {
    const attemptId = await startAttempt();

    await endTurn({
      attemptId,
      assistantText: [
        '<<comment-resolved threadId="PRRT_1" commitSha="abcdef1234567890">>',
        '<<comment-reply id="PRRT_1">>Renamed as asked.<</comment-reply>>',
        `<<comment-needs-run threadId="PRRT_2" reason="${FOUND}">>`,
      ].join('\n'),
    });

    const db = storySqlite();
    const rows = await listResolveThreads({ db, sessionId: session.id });
    expect(rows.find((row) => row.threadId === 'PRRT_1')).toMatchObject({
      disposition: 'fix',
      commitShas: ['abcdef1234567890'],
    });
    expect(rows.find((row) => row.threadId === 'PRRT_2')).toMatchObject({
      state: 'failed',
      stateReason: `needs_run:${FOUND}`,
      disposition: null,
      replyDraft: null,
    });
    const items = await listResolveQueueItems({ db, sessionId: session.id });
    expect(items.map(({ thread }) => thread.threadId)).toEqual(['PRRT_1']);
    const [attempt] = await listResolveAttempts({ db, sessionId: session.id });
    expect(attempt).toMatchObject({ phase: 'failed', failureCause: 'needs_a_run' });
  });

  it('keeps no_result for a silent sibling and Needs a run for its own thread', async () => {
    const attemptId = await startAttempt();

    await endTurn({
      attemptId,
      assistantText: `<<comment-needs-run threadId="PRRT_2" reason="${FOUND}">>`,
    });

    const db = storySqlite();
    const rows = await listResolveThreads({ db, sessionId: session.id });
    expect(rows.find((row) => row.threadId === 'PRRT_1')).toMatchObject({
      state: 'failed',
      stateReason: null,
    });
    expect(rows.find((row) => row.threadId === 'PRRT_2')?.stateReason).toBe(`needs_run:${FOUND}`);
    const [attempt] = await listResolveAttempts({ db, sessionId: session.id });
    expect(attempt).toMatchObject({ phase: 'failed', failureCause: 'no_result' });
  });

  it('records needs_a_run, not app_closed, when the app closed after every thread reported it', async () => {
    const attemptId = await startAttempt();
    await store.getState().persistResolveTurn({
      sessionId: session.id,
      agent: resolver,
      assistantText: '<<comment-wontfix threadId="PRRT_1" reason="intentional">>',
      isCandidate: true,
      attemptId,
    });
    const db = storySqlite();
    await db.execute('UPDATE resolve_attempts SET started_at = 1 WHERE id = ?', [attemptId]);
    await insertMessage(db, {
      id: crypto.randomUUID() as MessageId,
      sessionId: session.id,
      agentId: resolver.id,
      role: 'assistant',
      content: [
        `<<comment-needs-run threadId="PRRT_1" reason="${FOUND}">>`,
        '<<comment-needs-run threadId="PRRT_2" reason="It asks for a new payouts route.">>',
      ].join('\n'),
      createdAt: TEST_NOW,
    });

    await store.getState().loadResolveSession({ sessionId: session.id });

    const rows = await listResolveThreads({ db, sessionId: session.id });
    expect(Object.fromEntries(rows.map((row) => [row.threadId, row.stateReason]))).toEqual({
      PRRT_1: `needs_run:${FOUND}`,
      PRRT_2: 'needs_run:It asks for a new payouts route.',
    });
    const attempts = await listResolveAttempts({ db, sessionId: session.id });
    expect(attempts.find((attempt) => attempt.id === attemptId)).toMatchObject({
      phase: 'failed',
      failureCause: 'needs_a_run',
    });
  });
});
