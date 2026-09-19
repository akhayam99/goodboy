import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session, SessionId } from '@goodboy/types';

const { updateSessionAutoRunSpy } = vi.hoisted(() => ({
  updateSessionAutoRunSpy: vi.fn(async (..._args: ReadonlyArray<unknown>) => undefined),
}));

vi.mock('@goodboy/db', () => ({ updateSessionAutoRun: updateSessionAutoRunSpy }));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

import { setSessionAutoRun } from './setSessionAutoRun';

const SID = 'ses-1' as SessionId;
const OTHER = 'ses-2' as SessionId;

type StoreState = { sessions: ReadonlyArray<Session> };

const harness = () => {
  const state: StoreState = {
    sessions: [
      { id: SID, autoRun: false } as unknown as Session,
      { id: OTHER, autoRun: false } as unknown as Session,
    ],
  };
  const set = vi.fn((updater: unknown) => {
    Object.assign(state, (updater as (s: StoreState) => Partial<StoreState>)(state));
  });
  return { state, set: set as never };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('setSessionAutoRun', () => {
  it('writes the flag to the database and to the session in state', async () => {
    const { state, set } = harness();

    await setSessionAutoRun(set)(SID, true);

    expect(updateSessionAutoRunSpy).toHaveBeenCalledWith({}, SID, true, expect.any(String));
    expect(state.sessions.find((s) => s.id === SID)?.autoRun).toBe(true);
    expect(state.sessions.find((s) => s.id === OTHER)?.autoRun).toBe(false);
  });

  it('turns the flag back off', async () => {
    const { state, set } = harness();

    await setSessionAutoRun(set)(SID, true);
    await setSessionAutoRun(set)(SID, false);

    expect(updateSessionAutoRunSpy).toHaveBeenLastCalledWith({}, SID, false, expect.any(String));
    expect(state.sessions.find((s) => s.id === SID)?.autoRun).toBe(false);
  });
});
