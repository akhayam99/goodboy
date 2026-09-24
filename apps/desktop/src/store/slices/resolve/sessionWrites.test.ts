import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionId } from '@goodboy/types';
import type { GetFn, SetFn } from './types';

type Deferred = {
  readonly promise: Promise<void>;
  readonly resolve: () => void;
};

const deferred = (): Deferred => {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((onResolve) => {
    resolve = onResolve;
  });
  return { promise, resolve };
};

const h = vi.hoisted(() => ({
  events: [] as string[],
  drainGate: null as Promise<void> | null,
  activeSessionIds: [] as string[],
}));

vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));
vi.mock('@goodboy/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@goodboy/db')>()),
  listActiveResolveAttempts: vi.fn(async () =>
    h.activeSessionIds.map((sessionId) => ({ sessionId, mountTarget: null })),
  ),
  listResolveThreads: vi.fn(async () => []),
  listResolveAttempts: vi.fn(async () => []),
}));
vi.mock('./reconcileResolveAttempts', () => ({
  reconcileResolveAttempts: vi.fn(async () => undefined),
}));
vi.mock('./drainResolveQueue', () => ({
  drainResolveQueue: vi.fn(async ({ sessionId }: { readonly sessionId: string }) => {
    h.events.push(`drain:${sessionId}:start`);
    if (h.drainGate !== null) {
      await h.drainGate;
    }
    h.events.push(`drain:${sessionId}:end`);
  }),
}));
vi.mock('./acceptResolveQueueItem', () => ({
  acceptResolveQueueItem: vi.fn(async ({ sessionId }: { readonly sessionId: string }) => {
    h.events.push(`accept:${sessionId}`);
  }),
}));

const { createResolveSlice } = await import('./index');

const SESSION_A = 'session-a' as SessionId;
const SESSION_B = 'session-b' as SessionId;

const flush = async () => {
  for (let index = 0; index < 10; index += 1) {
    await Promise.resolve();
  }
};

const createActions = () => {
  const set = vi.fn() as unknown as SetFn;
  let actions: ReturnType<typeof createResolveSlice> | null = null;
  const get = (() => actions) as unknown as GetFn;
  actions = createResolveSlice({ set, get });
  return actions;
};

describe('resolve writes are serialized per session', () => {
  beforeEach(() => {
    h.events = [];
    h.drainGate = null;
    h.activeSessionIds = [];
  });

  it('lets another session write while one session drains slowly', async () => {
    const actions = createActions();
    const gate = deferred();
    h.drainGate = gate.promise;

    const drain = actions.drainResolveQueue({ sessionId: SESSION_A });
    await actions.acceptResolveQueueItem({
      sessionId: SESSION_B,
      itemId: 'item-1',
      revision: 1,
      reply: '',
    });

    expect(h.events).toEqual(['drain:session-a:start', 'accept:session-b']);
    gate.resolve();
    await drain;
  });

  it('keeps writes of one session in order behind its drain', async () => {
    const actions = createActions();
    const gate = deferred();
    h.drainGate = gate.promise;

    const drain = actions.drainResolveQueue({ sessionId: SESSION_A });
    const accept = actions.acceptResolveQueueItem({
      sessionId: SESSION_A,
      itemId: 'item-1',
      revision: 1,
      reply: '',
    });
    await flush();
    expect(h.events).toEqual(['drain:session-a:start']);

    gate.resolve();
    await Promise.all([drain, accept]);
    expect(h.events).toEqual(['drain:session-a:start', 'drain:session-a:end', 'accept:session-a']);
  });

  it('drains every active session through its own queue on reconcile', async () => {
    const actions = createActions();
    const gate = deferred();
    h.drainGate = gate.promise;
    h.activeSessionIds = [SESSION_A, SESSION_B];

    const reconcile = actions.reconcileResolveDrains();
    await flush();
    expect(h.events).toEqual(['drain:session-a:start', 'drain:session-b:start']);

    gate.resolve();
    await reconcile;
  });
});
