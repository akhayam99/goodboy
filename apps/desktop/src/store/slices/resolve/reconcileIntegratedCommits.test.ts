import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ResolveCandidate,
  ResolveCandidateItem,
  ResolveQueueItemWithThread,
  SessionId,
} from '@goodboy/types';
import { reconcileIntegratedCommits } from './reconcileIntegratedCommits';

const h = vi.hoisted(() => ({
  candidates: vi.fn<() => Promise<ReadonlyArray<ResolveCandidate>>>(),
  members: vi.fn<() => Promise<ReadonlyArray<ResolveCandidateItem>>>(),
  items: vi.fn<() => Promise<ReadonlyArray<ResolveQueueItemWithThread>>>(),
  remap: vi.fn(async () => undefined),
}));

vi.mock('@goodboy/db', () => ({
  listResolveCandidates: h.candidates,
  listResolveCandidateItems: h.members,
  listResolveQueueItems: h.items,
}));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));
vi.mock('./remapIntegratedCommits', () => ({ remapIntegratedCommits: h.remap }));

const SESSION = 'session' as SessionId;

const candidate = (overrides: Partial<ResolveCandidate>): ResolveCandidate =>
  ({
    id: 'candidate-1',
    sessionId: SESSION,
    revision: 1,
    baseSha: 'base',
    candidateSha: 'candidate',
    worktreePath: '/repos/ledger-core',
    mountTarget: null,
    state: 'integrated',
    integratedSha: 'picked',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }) as ResolveCandidate;

const entry = (id: string, threadId: string, deliveredAt: number | null) =>
  ({
    item: { id, deliveredAt },
    thread: { threadId, commitShas: ['candidate'] },
  }) as unknown as ResolveQueueItemWithThread;

beforeEach(() => {
  h.candidates.mockReset();
  h.members.mockReset();
  h.items.mockReset();
  h.remap.mockClear();
});

describe('reconcileIntegratedCommits', () => {
  it('remaps the undelivered threads of a cherry-picked candidate again', async () => {
    h.candidates.mockResolvedValue([candidate({})]);
    h.members.mockResolvedValue([
      { candidateId: 'candidate-1', queueItemId: 'item-1', itemRevision: 1 },
      { candidateId: 'candidate-1', queueItemId: 'item-2', itemRevision: 1 },
    ]);
    h.items.mockResolvedValue([entry('item-1', 'PRRT_1', null), entry('item-2', 'PRRT_2', 5)]);

    await reconcileIntegratedCommits({ sessionId: SESSION });

    expect(h.remap).toHaveBeenCalledWith({
      sessionId: SESSION,
      worktreePath: '/repos/ledger-core',
      baseSha: 'base',
      candidateSha: 'candidate',
      integratedSha: 'picked',
      threads: [{ threadId: 'PRRT_1', commitShas: ['candidate'] }],
    });
  });

  it('skips fast-forwarded and unfinished candidates', async () => {
    h.candidates.mockResolvedValue([
      candidate({ integratedSha: 'candidate' }),
      candidate({ id: 'candidate-2', state: 'ready', integratedSha: null }),
    ]);

    await reconcileIntegratedCommits({ sessionId: SESSION });

    expect(h.items).not.toHaveBeenCalled();
    expect(h.remap).not.toHaveBeenCalled();
  });
});
