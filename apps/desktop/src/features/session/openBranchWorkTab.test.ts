// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type MountId } from '@goodboy/types';
import { aProject, aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../store/storyHarness';
import { branchPlace } from '../../store/slices/navigation/place';
import { openBranchWorkTab } from './openBranchWorkTab';
import { aMountView } from './testing/aMountView';
import { aProjectMountOf } from './testing/aProjectMountOf';

const SESSION = aSession();
const LEDGER = aProject({ name: 'ledger-core' });
const PAYMENTS_PATH = '/work/payments-api/.goodboy/worktrees/fix-duplicate-credit';
const LEDGER_PATH = '/work/ledger-core/.goodboy/worktrees/ledger-rounding';

const ACTIVE_VIEW = aMountView({
  key: 'active',
  sessionId: SESSION.id,
  projectId: LEDGER.id,
  projectName: 'ledger-core',
  branch: 'fix/duplicate-credit',
});
const PATHLESS_VIEW = aMountView({
  key: 'pathless',
  sessionId: SESSION.id,
  projectId: LEDGER.id,
  projectName: 'ledger-core',
  branch: 'ledger-rounding',
});
const ACTIVE = aProjectMountOf({ view: ACTIVE_VIEW, worktreePath: PAYMENTS_PATH });
const PATHLESS = aProjectMountOf({ view: PATHLESS_VIEW, worktreePath: LEDGER_PATH });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    sessionProjectMounts: { [SESSION.id]: [ACTIVE, PATHLESS] },
    sessionMounts: {
      [SESSION.id]: [
        { ...ACTIVE_VIEW, worktreePath: PAYMENTS_PATH },
        { ...PATHLESS_VIEW, worktreePath: null },
      ],
    },
    navigate: vi.fn(),
  });
});

describe('openBranchWorkTab', () => {
  it('lands on the Work tab of the mount it names when the session row has no worktree path', () => {
    openBranchWorkTab({ sessionId: SESSION.id, mountId: PATHLESS.mountId });

    expect(useAppStore.getState().navigate).toHaveBeenCalledWith({
      to: branchPlace({ sessionId: SESSION.id, mountPath: LEDGER_PATH, tab: 'work' }),
    });
  });

  it('never opens the fallback branch for a mount the Branch page does not know', () => {
    openBranchWorkTab({ sessionId: SESSION.id, mountId: brandId<MountId>({ value: 'gone' }) });

    expect(useAppStore.getState().navigate).not.toHaveBeenCalled();
  });
});
