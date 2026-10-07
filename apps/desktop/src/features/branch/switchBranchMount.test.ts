// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MountId, SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../store/storyHarness';
import { branchPlace } from '../../store/slices/navigation/place';
import { switchBranchMount } from './switchBranchMount';

type StoreState = ReturnType<StoryStore['getState']>;

const SESSION = 'session-ledger-export' as SessionId;
const MOUNT = 'mount-ledger-core-fix' as MountId;
const PATH = '/work/ledger-core-fix';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

describe('switchBranchMount', () => {
  it('makes the mount the write destination, then opens its branch page on the same tab', async () => {
    const navigate = vi.fn<StoreState['navigate']>();
    const setSessionActiveMount = vi.fn<StoreState['setSessionActiveMount']>(async () => undefined);
    useAppStore.setState({ navigate, setSessionActiveMount, branchTab: { [SESSION]: 'files' } });

    await switchBranchMount({ sessionId: SESSION, mountId: MOUNT, worktreePath: PATH });

    expect(setSessionActiveMount).toHaveBeenCalledWith({ sessionId: SESSION, mountId: MOUNT });
    expect(navigate).toHaveBeenCalledWith({
      to: branchPlace({ sessionId: SESSION, mountPath: PATH, tab: 'files' }),
      mode: 'replace',
    });
  });

  it('reports the failure and stays on the page when the mount cannot become the destination', async () => {
    const failure = new Error('mount is no longer writable');
    const navigate = vi.fn<StoreState['navigate']>();
    const reportError = vi.fn<StoreState['reportError']>(async () => undefined);
    useAppStore.setState({
      navigate,
      reportError,
      setSessionActiveMount: vi.fn<StoreState['setSessionActiveMount']>(async () => {
        throw failure;
      }),
    });

    await switchBranchMount({ sessionId: SESSION, mountId: MOUNT, worktreePath: PATH });

    expect(navigate).not.toHaveBeenCalled();
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ error: failure, sessionId: SESSION }),
    );
  });
});
