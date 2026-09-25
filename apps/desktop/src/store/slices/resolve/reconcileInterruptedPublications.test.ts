import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  insertResolvePublication,
  listResolvePublicationThreads,
  listResolvePublicationsForSession,
  listResolveThreads,
  upsertResolvePublicationThread,
  upsertResolveThread,
} from '@goodboy/db';
import type {
  ResolvePublication,
  ResolvePublicationThread,
  ResolveThread,
  SessionId,
} from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { PUBLICATION_STALE_MS } from './publicationHeartbeat';
import { isPublicationTargetBusy, withPublicationLock } from './publicationLock';
import {
  PUBLICATION_INTERRUPTED,
  reconcileInterruptedPublications,
} from './reconcileInterruptedPublications';

const h = vi.hoisted(() => ({ reset: (): void => undefined }));

vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

vi.mock('@goodboy/db', async () => {
  const mocks = (await import('./testing/createResolveQueryMocks')).createResolveQueryMocks();
  h.reset = mocks.resetResolveQueryMocks;
  return mocks;
});

const SESSION = 'session' as SessionId;
const NOW = 1_000_000;

const publication = (overrides: Partial<ResolvePublication> = {}): ResolvePublication => ({
  id: 'pub-1',
  sessionId: SESSION,
  repo: 'acme/ledger-core',
  prNumber: 12,
  branch: 'feature/retry',
  targetRef: 'refs/heads/feature/retry',
  localHead: '4f21c8b',
  remoteHead: null,
  commitShas: ['4f21c8b'],
  candidateIds: [],
  approvedItemIds: [],
  requiresPush: true,
  mountTarget: null,
  phase: 'posting',
  pushedHead: '4f21c8b',
  confirmedAt: NOW - PUBLICATION_STALE_MS * 2,
  completedAt: null,
  holder: 'main:gone',
  heartbeatAt: NOW - PUBLICATION_STALE_MS * 2,
  error: null,
  createdAt: NOW - PUBLICATION_STALE_MS * 3,
  ...overrides,
});

const receipt = (overrides: Partial<ResolvePublicationThread>): ResolvePublicationThread => ({
  publicationId: 'pub-1',
  threadId: 'T1',
  revision: 2,
  priorState: 'fixed',
  sourceFingerprint: null,
  operationId: 'op-1',
  replyBody: 'Fixed in 4f21c8b.',
  replyPhase: 'pending',
  replyId: null,
  replyAttemptedAt: null,
  replyPostedAt: null,
  resolvePhase: 'pending',
  resolvedAt: null,
  error: null,
  ...overrides,
});

const thread = (threadId: string): ResolveThread => ({
  id: `row-${threadId}`,
  sessionId: SESSION,
  projectId: null,
  prNumber: 12,
  threadId,
  originKind: 'review_comment',
  state: 'publishing',
  stage: 'new',
  stateReason: null,
  revision: 0,
  activeAttemptId: null,
  disposition: 'fix',
  replyDraft: 'Fixed in 4f21c8b.',
  commitShas: ['4f21c8b'],
  question: null,
  replyPostedAt: null,
  replyId: null,
  githubResolved: null,
  closedAt: null,
  closedSource: null,
  createdAt: 1,
  updatedAt: 1,
});

beforeEach(() => {
  h.reset();
});

describe('reconcileInterruptedPublications', () => {
  it('closes a publication whose holder stopped beating, keeping what already landed', async () => {
    await insertResolvePublication({ db: tauriDatabase, publication: publication() });
    for (const threadId of ['T1', 'T2', 'T3']) {
      await upsertResolveThread({
        db: tauriDatabase,
        row: thread(threadId),
        expectedRevision: null,
      });
    }
    await upsertResolvePublicationThread({
      db: tauriDatabase,
      thread: receipt({
        threadId: 'T1',
        replyPhase: 'posted',
        replyPostedAt: 5,
        resolvePhase: 'resolved',
        resolvedAt: 6,
      }),
    });
    await upsertResolvePublicationThread({
      db: tauriDatabase,
      thread: receipt({ threadId: 'T2', operationId: 'op-2', replyPhase: 'sending' }),
    });
    await upsertResolvePublicationThread({
      db: tauriDatabase,
      thread: receipt({ threadId: 'T3', operationId: 'op-3' }),
    });

    const live = await reconcileInterruptedPublications({
      publications: [publication()],
      now: NOW,
    });

    expect(live).toEqual([]);
    const [stored] = await listResolvePublicationsForSession({
      db: tauriDatabase,
      sessionId: SESSION,
    });
    expect(stored).toMatchObject({
      phase: 'failed',
      error: PUBLICATION_INTERRUPTED,
      pushedHead: '4f21c8b',
    });
    const receipts = await listResolvePublicationThreads({
      db: tauriDatabase,
      publicationId: 'pub-1',
    });
    expect(receipts.find((item) => item.threadId === 'T1')).toMatchObject({
      replyPhase: 'posted',
      error: null,
    });
    expect(receipts.find((item) => item.threadId === 'T2')).toMatchObject({
      replyPhase: 'uncertain',
    });
    expect(receipts.find((item) => item.threadId === 'T3')).toMatchObject({
      replyPhase: 'pending',
      error: PUBLICATION_INTERRUPTED,
    });
    const rows = await listResolveThreads({ db: tauriDatabase, sessionId: SESSION });
    expect(rows.find((row) => row.threadId === 'T1')?.state).toBe('publishing');
    expect(rows.find((row) => row.threadId === 'T2')).toMatchObject({ state: 'fixed' });
    expect(rows.find((row) => row.threadId === 'T2')?.stateReason).toContain('uncertain');
    expect(rows.find((row) => row.threadId === 'T3')?.stateReason).toMatch(/^publication_failed:/);
  });

  it('leaves a publication with a fresh heartbeat to its holder', async () => {
    const fresh = publication({ heartbeatAt: NOW - 1_000 });
    await insertResolvePublication({ db: tauriDatabase, publication: fresh });

    const live = await reconcileInterruptedPublications({ publications: [fresh], now: NOW });

    expect(live).toEqual([fresh]);
    const [stored] = await listResolvePublicationsForSession({
      db: tauriDatabase,
      sessionId: SESSION,
    });
    expect(stored?.phase).toBe('posting');
  });

  it('stops a crashed publication from holding the pull request busy', async () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
    await insertResolvePublication({ db: tauriDatabase, publication: publication() });

    const busy = await isPublicationTargetBusy({ repo: 'acme/ledger-core', prNumber: 12 });
    const ran = await withPublicationLock({
      repo: 'acme/ledger-core',
      prNumber: 12,
      onBusy: () => 'busy',
      run: async () => 'ran',
    });

    vi.useRealTimers();
    expect(busy).toBe(false);
    expect(ran).toBe('ran');
  });

  it('treats a publication from before heartbeats by the time it was confirmed', async () => {
    const legacy = publication({ holder: null, heartbeatAt: null, confirmedAt: NOW - 5_000 });

    expect(await reconcileInterruptedPublications({ publications: [legacy], now: NOW })).toEqual([
      legacy,
    ]);
  });
});
