import { afterEach, describe, expect, it, vi } from 'vitest';
import type { IsoDateTime, PendingResolution, SessionId } from '@goodboy/types';
import type { GetFn, SetFn } from './types';

const h = vi.hoisted(() => ({
  listPendingResolutionsForSession: vi.fn(),
}));

vi.mock('@goodboy/db', () => ({
  listPendingResolutionsForSession: h.listPendingResolutionsForSession,
}));

vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

import { loadPendingResolutions } from './loadPendingResolutions';

const SESSION_ID = 'sess-1' as SessionId;

const row = (threadId: string): PendingResolution => ({
  id: `row-${threadId}`,
  sessionId: SESSION_ID,
  prNumber: 5,
  threadId,
  commitSha: '',
  reply: null,
  outcome: null,
  replyPostedAt: null,
  createdAt: '2026-08-05T00:00:00.000Z' as IsoDateTime,
});

type State = {
  sessionPendingResolutions: Record<string, ReadonlyArray<PendingResolution>>;
};

const makeStore = () => {
  const state: State = { sessionPendingResolutions: {} };
  const get = (() => state) as unknown as GetFn;
  const set = ((update: unknown) => {
    const patch =
      typeof update === 'function'
        ? (update as (s: State) => Partial<State>)(state)
        : (update as Partial<State>);
    Object.assign(state, patch);
  }) as unknown as SetFn;
  return { state, get, set };
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('loadPendingResolutions', () => {
  it('reads the DB once when session activation and the strip mount race for the same session', async () => {
    let resolveRead!: (rows: ReadonlyArray<PendingResolution>) => void;
    h.listPendingResolutionsForSession.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRead = resolve;
      }),
    );
    const { state, get, set } = makeStore();
    const load = loadPendingResolutions(set, get);

    const fromActivation = load(SESSION_ID);
    const fromStripMount = load(SESSION_ID);

    resolveRead([row('T1')]);
    await Promise.all([fromActivation, fromStripMount]);

    expect(h.listPendingResolutionsForSession).toHaveBeenCalledTimes(1);
    expect(state.sessionPendingResolutions[SESSION_ID]).toEqual([row('T1')]);
  });

  it('skips the read once the session already has a loaded row, so a strip remount does not refetch', async () => {
    h.listPendingResolutionsForSession.mockResolvedValueOnce([row('T1')]);
    const { state, get, set } = makeStore();
    const load = loadPendingResolutions(set, get);

    await load(SESSION_ID);
    await load(SESSION_ID);

    expect(h.listPendingResolutionsForSession).toHaveBeenCalledTimes(1);
    expect(state.sessionPendingResolutions[SESSION_ID]).toEqual([row('T1')]);
  });
});
