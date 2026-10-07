// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MountId, SessionId } from '@goodboy/types';
import { branchPlace } from '../../store/slices/navigation/place';

const h = vi.hoisted(() => ({
  setSessionActiveMount: vi.fn(async (_params: unknown) => undefined),
  navigate: vi.fn(),
  reportError: vi.fn(async (_params: unknown) => undefined),
  branchTab: {} as Record<string, string>,
}));

vi.mock('../../store', () => ({
  useAppStore: {
    getState: () => ({
      setSessionActiveMount: h.setSessionActiveMount,
      navigate: h.navigate,
      reportError: h.reportError,
      branchTab: h.branchTab,
    }),
  },
}));

import { switchBranchMount } from './switchBranchMount';

const SESSION = 'session-1' as SessionId;
const MOUNT = 'mount-2' as MountId;
const PATH = '/work/ledger-core-fix';

beforeEach(() => {
  h.setSessionActiveMount.mockReset().mockResolvedValue(undefined);
  h.navigate.mockReset();
  h.reportError.mockReset().mockResolvedValue(undefined);
  h.branchTab = {};
});

describe('switchBranchMount', () => {
  it('makes the mount the write destination, then opens its branch page on the same tab', async () => {
    h.branchTab = { [SESSION]: 'files' };

    await switchBranchMount({ sessionId: SESSION, mountId: MOUNT, worktreePath: PATH });

    expect(h.setSessionActiveMount).toHaveBeenCalledWith({ sessionId: SESSION, mountId: MOUNT });
    expect(h.navigate).toHaveBeenCalledWith({
      to: branchPlace({ sessionId: SESSION, mountPath: PATH, tab: 'files' }),
      mode: 'replace',
    });
  });

  it('reports the failure and stays on the page when the mount cannot become the destination', async () => {
    const failure = new Error('mount is no longer writable');
    h.setSessionActiveMount.mockRejectedValue(failure);

    await switchBranchMount({ sessionId: SESSION, mountId: MOUNT, worktreePath: PATH });

    expect(h.navigate).not.toHaveBeenCalled();
    expect(h.reportError).toHaveBeenCalledWith(
      expect.objectContaining({ error: failure, sessionId: SESSION }),
    );
  });
});
