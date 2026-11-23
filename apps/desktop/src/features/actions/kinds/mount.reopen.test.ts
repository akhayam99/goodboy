// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).dbLibModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type MountId, type ProjectId, type SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import { resolveActions } from '../resolveActions';
import type { ActionEnv } from '../types';
import { MOUNT_KIND } from './mount';
import type { MountFacts } from './mountFacts';

const SESSION_ID = brandId<SessionId>({ value: 'session-harborline' });
const MOUNT_ID = brandId<MountId>({ value: 'mount-payments' });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

const env: ActionEnv = {
  getState: () => useAppStore.getState(),
  showToast: vi.fn(),
  copyText: async () => undefined,
  origin: 'menu',
  anchorKey: null,
  viewing: null,
};

const closedMount = (overrides: Partial<MountFacts>): MountFacts => ({
  sessionId: SESSION_ID,
  mountId: MOUNT_ID,
  projectId: brandId<ProjectId>({ value: 'project-payments' }),
  label: 'hl/fix-duplicate-credit',
  branch: 'hl/fix-duplicate-credit',
  baseBranch: 'main',
  mountBaseBranch: null,
  worktreePath: null,
  keptPath: null,
  isRepo: true,
  isClosed: true,
  isBranchGone: false,
  canRestoreBranch: false,
  pr: 'open',
  requestLabel: 'PR #318',
  requestNumber: 318,
  requestProvider: 'github',
  createProvider: 'github',
  ahead: 0,
  unpushed: 0,
  behind: 0,
  dirty: 0,
  isDiverged: false,
  onlyOnline: null,
  isRebasing: false,
  rebaseConflict: null,
  autoBlockedReason: null,
  comments: 0,
  canStartTurnsHere: false,
  isScribeWriting: false,
  blockers: [],
  pinnedRunIds: [],
  pinnedRunLabel: null,
  editors: [],
  ...overrides,
});

type OverridesParams = {
  readonly overrides: Partial<MountFacts>;
};

const reopenOf = ({ overrides }: OverridesParams) =>
  resolveActions({ definitions: MOUNT_KIND.actions, facts: closedMount(overrides) }).find(
    (action) => action.id === 'mount.reopen',
  );

const runReopen = async ({ overrides }: OverridesParams) => {
  const attachMount = vi
    .spyOn(useAppStore.getState(), 'attachMount')
    .mockRejectedValue(new Error('attach stopped in the test'));
  const definition = MOUNT_KIND.actions.find((action) => action.id === 'mount.reopen');
  await Promise.resolve(
    definition?.run({ facts: closedMount(overrides), env, choice: null }),
  ).catch(() => undefined);
  return attachMount;
};

describe('mount.reopen', () => {
  it('fetches the remote and falls back to the open pull request head', async () => {
    const attachMount = await runReopen({ overrides: {} });

    expect(attachMount).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      canFetchRemote: true,
      fallbackRef: 'pull/318/head',
    });
  });

  it('reopens a merged branch from the local branch only', async () => {
    const attachMount = await runReopen({ overrides: { pr: 'merged' } });

    expect(attachMount).toHaveBeenCalledWith({ sessionId: SESSION_ID, mountId: MOUNT_ID });
  });

  it('stays offered when the local branch is gone but the stored open pull request head can be fetched', () => {
    expect(
      reopenOf({
        overrides: { isBranchGone: true, fetchableRequest: { provider: 'github', prNumber: 318 } },
      }),
    ).toBeDefined();
  });

  it('is not offered for a gone branch when no stored open pull request can be fetched', () => {
    expect(reopenOf({ overrides: { isBranchGone: true } })).toBeUndefined();
    expect(reopenOf({ overrides: { isBranchGone: true, fetchableRequest: null } })).toBeUndefined();
  });

  it('fetches the stored pull request head when the gone branch has no live request', async () => {
    const attachMount = await runReopen({
      overrides: {
        isBranchGone: true,
        pr: null,
        requestNumber: null,
        requestProvider: null,
        fetchableRequest: { provider: 'gitlab', prNumber: 41 },
      },
    });

    expect(attachMount).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      canFetchRemote: true,
      fallbackRef: 'merge-requests/41/head',
    });
  });

  it('is not offered for a gone branch of a merged pull request', () => {
    expect(reopenOf({ overrides: { isBranchGone: true, pr: 'merged' } })).toBeUndefined();
  });
});
