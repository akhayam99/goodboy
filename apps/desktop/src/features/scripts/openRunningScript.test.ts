import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MountId, SessionId } from '@goodboy/types';

const { store } = vi.hoisted(() => ({
  store: {
    setCurrentSession: vi.fn(async () => undefined),
    openDrawer: vi.fn(),
  },
}));

vi.mock('../../store', () => ({
  useAppStore: { getState: () => store },
}));

import { openRunningScript } from './openRunningScript';

const SESSION_ID = 'session-1' as SessionId;
const MOUNT_ID = 'mount-ledger' as MountId;

beforeEach(() => {
  store.setCurrentSession.mockClear();
  store.openDrawer.mockClear();
});

describe('openRunningScript', () => {
  it('moves to the session and opens the script output in the drawer', async () => {
    await openRunningScript({
      run: {
        sessionId: SESSION_ID,
        sessionGoal: 'Fix the rounding bug',
        scriptId: 'script-1',
        mountId: MOUNT_ID,
        scriptName: 'test',
        startedAt: 0,
      },
    });

    expect(store.setCurrentSession).toHaveBeenCalledWith(SESSION_ID);
    expect(store.openDrawer).toHaveBeenCalledWith({
      kind: 'scriptRun',
      sessionId: SESSION_ID,
      payload: { scriptKey: 'script-1', mountId: MOUNT_ID },
    });
  });
});
