// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MenuItemEntry } from '@goodboy/ui';
import {
  brandId,
  type IsoDateTime,
  type MountId,
  type ProjectId,
  type SessionId,
  type SessionMountView,
} from '@goodboy/types';
import type { AppStore } from '../../../store/store';
import {
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../../store/storyHarness';
import { MOUNT_ROW_STATES } from '../../../__tests__/helpers/rowMenuStates';
import { resolveActions } from '../resolveActions';
import { toMenuEntries } from '../toMenuEntries';
import type { ActionEnv } from '../types';
import { MOUNT_KIND } from './mount';
import type { MountFacts } from './mountFacts';

let useAppStore: StoryStore;

type StateParams = {
  readonly state: string;
  readonly overrides?: Partial<MountFacts>;
};

type ItemParams = {
  readonly facts: MountFacts;
  readonly env: ActionEnv;
};

const factsOf = ({ state, overrides = {} }: StateParams): MountFacts => {
  const found = MOUNT_ROW_STATES.find(([name]) => name === state)?.[1];
  if (found === undefined) {
    throw new Error(`no mount state ${state}`);
  }
  return { ...found, ...overrides };
};

const envOf = (): ActionEnv => ({
  getState: () => useAppStore.getState(),
  showToast: vi.fn(),
  copyText: async () => undefined,
  origin: 'overflow',
  anchorKey: null,
  viewing: null,
});

const closeItemOf = ({ facts, env }: ItemParams): MenuItemEntry => {
  const entry = toMenuEntries({
    actions: resolveActions({ definitions: MOUNT_KIND.actions, facts }),
    env,
    run: async ({ actionId }) => {
      const definition = MOUNT_KIND.actions.find((action) => action.id === actionId);
      await definition?.run({ facts, env, choice: null });
    },
  }).find(
    (candidate): candidate is MenuItemEntry =>
      candidate.kind === 'item' && candidate.key === 'mount.close',
  );
  if (entry === undefined) {
    throw new Error('no Close branch row');
  }
  return entry;
};

const AT = brandId<IsoDateTime>({ value: '2026-11-20T09:00:00.000Z' });

const CLOSED_VIEW: SessionMountView = {
  id: brandId<MountId>({ value: 'mount-payments' }),
  sessionId: brandId<SessionId>({ value: 'session-harborline' }),
  projectId: brandId<ProjectId>({ value: 'project-payments' }),
  worktreePath: null,
  lastWorktreePath: '/work/payments-api',
  branch: 'hl/fix-duplicate-credit',
  baseBranch: 'main',
  parallelIndex: 0,
  mountName: 'payments-api',
  repoSlug: null,
  isAttached: false,
  diskState: 'removed',
  revision: 2,
  createdAt: AT,
  updatedAt: AT,
  repoRoot: '/work/payments-api',
};

const spyStore = () => {
  const unmountMount = vi.fn<AppStore['unmountMount']>(async () => ({
    mount: CLOSED_VIEW,
    kept: false,
    reason: null,
  }));
  const removeMountWorktree = vi.fn<AppStore['removeMountWorktree']>(async () => ({
    kind: 'removed',
    reason: null,
  }));
  useAppStore.setState({ unmountMount, removeMountWorktree });
  return { unmountMount, removeMountWorktree };
};

const OPEN = 'PR open, 3 to resolve';

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

describe('Close branch asks first and names what happens to the folder', () => {
  it('is a red row whose confirm offers Remove the folder and Keep the folder on a clean branch', () => {
    const item = closeItemOf({ facts: factsOf({ state: OPEN }), env: envOf() });

    expect(item.label).toBe('Close branch');
    expect(item.isDestructive).toBe(true);
    expect(item.confirm?.title).toBe('Close the branch for hl/fix-duplicate-credit?');
    expect(item.confirm?.description).toBe('Remove its folder or keep it on disk.');
    expect(item.confirm?.notes).toEqual(['The branch and any pull request stay.']);
    expect(item.confirm?.confirmLabel).toBe('Remove the folder');
    expect(item.confirm?.alt?.label).toBe('Keep the folder');
  });

  it('removes the folder and refuses to detach when the folder has to stay', async () => {
    const { unmountMount } = spyStore();
    const item = closeItemOf({ facts: factsOf({ state: OPEN }), env: envOf() });

    await item.onSelect(null);

    expect(unmountMount).toHaveBeenCalledWith(
      expect.objectContaining({ mountId: 'mount-payments', onKeptFolder: 'refuse' }),
    );
  });

  it('keeps the folder on disk with Keep the folder', async () => {
    const { unmountMount } = spyStore();
    const env = envOf();
    const item = closeItemOf({ facts: factsOf({ state: OPEN }), env });

    await item.confirm?.alt?.onSelect();

    expect(unmountMount).toHaveBeenCalledWith(
      expect.objectContaining({ mountId: 'mount-payments', keepDirectory: true }),
    );
    expect(env.showToast).toHaveBeenCalledWith({
      kind: 'info',
      message: 'Folder kept at /work/payments-api',
    });
  });

  it.each([
    [{ dirty: 2 }, 'It has 2 uncommitted changes. Its folder stays on disk.'],
    [{ unpushed: 1 }, 'It has 1 commit not pushed. Its folder stays on disk.'],
    [
      { dirty: 1, unpushed: 3 },
      'It has 1 uncommitted change and 3 commits not pushed. Its folder stays on disk.',
    ],
  ])('offers only Keep the folder with %o', async (overrides, sentence) => {
    const { unmountMount } = spyStore();
    const item = closeItemOf({ facts: factsOf({ state: OPEN, overrides }), env: envOf() });

    expect(item.confirm?.description).toBe(sentence);
    expect(item.confirm?.confirmLabel).toBe('Keep the folder');
    expect(item.confirm?.alt).toBeUndefined();
    await item.onSelect(null);
    expect(unmountMount).toHaveBeenCalledWith(expect.objectContaining({ keepDirectory: true }));
  });

  it('removes only the folder of a merged branch and keeps its local branch', async () => {
    const { removeMountWorktree } = spyStore();
    const facts = factsOf({ state: 'Merged' });
    const close = MOUNT_KIND.actions.find((action) => action.id === 'mount.close');

    expect(close?.confirm?.({ facts })?.confirmLabel).toBe('Remove the folder');
    await close?.run({ facts, env: envOf(), choice: null });
    expect(removeMountWorktree).toHaveBeenCalledWith(
      expect.objectContaining({ mountId: 'mount-payments', mode: 'safe' }),
    );
  });

  it('shows the reason and leaves the branch as it was when the removal fails', async () => {
    const unmountMount = vi.fn<AppStore['unmountMount']>(async () => {
      throw new Error('The folder stayed: an agent is running');
    });
    useAppStore.setState({ unmountMount });
    const env = envOf();
    const item = closeItemOf({ facts: factsOf({ state: OPEN }), env });

    await item.onSelect(null);

    expect(env.showToast).toHaveBeenCalledWith({
      kind: 'warning',
      title: "Couldn't finish that",
      message: 'The folder stayed: an agent is running',
    });
  });
});
