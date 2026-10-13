// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MountId } from '@goodboy/types';
import { nextSessionId } from '@goodboy/types/testing';

vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);

import { stubStoryInvoke } from '../../../store/storyHarness';
import { useAppStore, type AppStore } from '../../../store/store';
import type { ActionEnv } from '../types';
import { pushMount } from './gitRuns';

const SESSION_ID = nextSessionId();
const MOUNT_ID: MountId = JSON.parse(JSON.stringify('mount-payments-api'));

type PushFn = AppStore['pushSessionBranch'];
type ForcePushFn = AppStore['forcePushSessionBranch'];

const envWith = ({
  forcePushSessionBranch,
  pushSessionBranch,
}: {
  readonly forcePushSessionBranch: ForcePushFn;
  readonly pushSessionBranch: PushFn;
}): ActionEnv => {
  const state: AppStore = {
    ...useAppStore.getInitialState(),
    forcePushSessionBranch,
    pushSessionBranch,
  };
  return {
    getState: () => state,
    showToast: vi.fn(),
    copyText: async () => undefined,
    origin: 'overflow',
    anchorKey: null,
    viewing: null,
  };
};

describe('pushMount', () => {
  beforeEach(() => {
    stubStoryInvoke({ worktree_status: null });
  });

  it('hands the force push the exact shas the confirm listed', async () => {
    const forcePushSessionBranch = vi.fn<ForcePushFn>(async () => ({ ok: true }));
    const pushSessionBranch = vi.fn<PushFn>(async () => ({ ok: true }));

    await pushMount({
      env: envWith({ forcePushSessionBranch, pushSessionBranch }),
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      worktreePath: '/work/payments-api',
      baseBranch: null,
      isForce: true,
      confirmedOnlyOnline: [
        { sha: 'a1', subject: 'Fix rounding' },
        { sha: 'b2', subject: 'Add retry' },
      ],
    });

    expect(forcePushSessionBranch).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      confirmedOnlyOnline: ['a1', 'b2'],
      confirmedRemoteSha: null,
    });
    expect(pushSessionBranch).not.toHaveBeenCalled();
  });

  it('hands the force push null when the confirm said not checked yet', async () => {
    const forcePushSessionBranch = vi.fn<ForcePushFn>(async () => ({ ok: true }));

    await pushMount({
      env: envWith({ forcePushSessionBranch, pushSessionBranch: vi.fn<PushFn>() }),
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      worktreePath: '/work/payments-api',
      baseBranch: null,
      isForce: true,
      confirmedOnlyOnline: null,
    });

    expect(forcePushSessionBranch).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      confirmedOnlyOnline: null,
      confirmedRemoteSha: null,
    });
  });

  it('keeps the remote sha the confirm listed on the failure it throws', async () => {
    const onlineModule = await import('../../../store/slices/worktreeStatuses/onlyOnline');
    const forcePushSessionBranch = vi.fn<ForcePushFn>(async () => ({ ok: false, error: 'stale' }));
    vi.spyOn(onlineModule, 'readOnlineRemoteSha').mockReturnValue('confirmed-sha');

    const failure = await pushMount({
      env: envWith({ forcePushSessionBranch, pushSessionBranch: vi.fn<PushFn>() }),
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      worktreePath: '/work/payments-api',
      baseBranch: null,
      isForce: true,
      confirmedOnlyOnline: null,
    }).catch((error: unknown) => error);

    expect(failure).toMatchObject({ confirmedRemoteSha: 'confirmed-sha' });
  });

  it('throws the refusal so the user sees it', async () => {
    const forcePushSessionBranch = vi.fn<ForcePushFn>(async () => ({
      ok: false,
      error: 'The online copy changed. Check again before force pushing.',
    }));

    await expect(
      pushMount({
        env: envWith({ forcePushSessionBranch, pushSessionBranch: vi.fn<PushFn>() }),
        sessionId: SESSION_ID,
        mountId: MOUNT_ID,
        worktreePath: '/work/payments-api',
        baseBranch: null,
        isForce: true,
        confirmedOnlyOnline: [],
      }),
    ).rejects.toThrow('The online copy changed. Check again before force pushing.');
  });
});
