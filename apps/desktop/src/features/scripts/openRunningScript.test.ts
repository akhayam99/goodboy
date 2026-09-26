import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sessionPlace } from '../../store/slices/navigation/place';
import type { MountId, SessionId } from '@goodboy/types';

const { store } = vi.hoisted(() => ({
  store: {
    navigate: vi.fn(),
    openDrawer: vi.fn(),
  },
}));

vi.mock('../../store', async () => ({
  ...(await import('../../store/slices/navigation/place')),
  useAppStore: { getState: () => store },
}));

import { openRunningScript } from './openRunningScript';

const SESSION_ID = 'session-1' as SessionId;
const MOUNT_ID = 'mount-ledger' as MountId;

beforeEach(() => {
  store.navigate.mockClear();
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

    expect(store.navigate).toHaveBeenCalledWith({ to: sessionPlace({ sessionId: SESSION_ID }) });
    expect(store.openDrawer).toHaveBeenCalledWith({
      kind: 'scriptRun',
      sessionId: SESSION_ID,
      payload: { scriptKey: 'script-1', mountId: MOUNT_ID },
    });
  });
});
