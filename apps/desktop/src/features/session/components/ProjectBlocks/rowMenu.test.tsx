// @vitest-environment happy-dom
vi.hoisted(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 18, 10, 31, 0));
});

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { WorktreeStatus } from '@goodboy/types';
import { TEST_NOW } from '@goodboy/types/testing';
import type { AppStore } from '../../../../store/store';
import { ToastProvider } from '../../../../shared/components/Toast';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../store/storyHarness';
import { installFakeResizeObserver } from '../../../../test/fakeResizeObserver';
import { sceneInvoke, clearSceneInvoke } from '../../../../test/sceneInvoke';
import { resetWorktreeStatusCache } from '../../../../store/runtime/worktreeStatuses/cache';
import { AutoReleaseContext } from '../../../auto/autoReleaseContext';
import { ObjectMenuProvider } from '../../../actions/components/ObjectMenuProvider';
import {
  COLUMN_SESSION_ID,
  seedCentralColumn,
} from '../../../../app/components/MockScene/scenes/u26/centralColumnSeed';
import { CTX_STATUS } from '../../../../app/components/MockScene/scenes/brand/contextBranch';

let useAppStore: Awaited<ReturnType<typeof importStore>>;
let SessionOverviewPane: typeof import('../SessionOverviewPane').SessionOverviewPane;
let SessionContextCards: typeof import('../../../../app/components/SessionContextCards').SessionContextCards;

const TENANT = 'hl/tenant-limits';

const ACTIONS = `payments-api · ${TENANT} actions`;

beforeAll(async () => {
  installFakeResizeObserver();
  Element.prototype.scrollIntoView = vi.fn();
  useAppStore = await importStore();
  ({ SessionOverviewPane } = await import('../SessionOverviewPane'));
  ({ SessionContextCards } = await import('../../../../app/components/SessionContextCards'));
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  window.localStorage.clear();
  await resetStoryStore();
  resetWorktreeStatusCache();
  clearSceneInvoke();
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('The scene command must be a string.');
    }
    return sceneInvoke({ command, args });
  });
});

afterEach(cleanup);

afterAll(() => {
  vi.useRealTimers();
});

const mountedSession = () => {
  const session = useAppStore
    .getState()
    .sessions.find((candidate) => candidate.id === COLUMN_SESSION_ID);
  if (session === undefined) {
    throw new Error('The seed must hold the session');
  }
  return session;
};

const tenantMount = () => {
  const mount = (useAppStore.getState().sessionProjectMounts[COLUMN_SESSION_ID] ?? []).find(
    (candidate) => candidate.branch === TENANT,
  );
  if (mount === undefined) {
    throw new Error('The seed must hold the tenant branch');
  }
  return mount;
};

const settle = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
};

type ShowParams = {
  readonly hasRail: boolean;
};

const show = async ({ hasRail }: ShowParams) => {
  const session = mountedSession();
  render(
    <ToastProvider>
      <ObjectMenuProvider>
        <AutoReleaseContext.Provider value>
          {hasRail ? <SessionContextCards session={session} /> : null}
          <SessionOverviewPane session={session} />
        </AutoReleaseContext.Provider>
      </ObjectMenuProvider>
    </ToastProvider>,
  );
  await settle();
};

const tenantTile = (): HTMLElement => {
  const tile = screen
    .getByRole('link', { name: `Open ${TENANT}` })
    .closest<HTMLElement>('[data-board-row]');
  if (tile === null) {
    throw new Error('The link must sit in a tile.');
  }
  return tile;
};

const menuLabels = async (): Promise<ReadonlyArray<string>> =>
  (await screen.findAllByRole('menuitem')).map((item) => item.textContent ?? '');

const closeMenu = async () => {
  fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
  await settle();
};

const pending = (): Promise<never> => new Promise<never>(() => undefined);

const DIRTY_STATUS: WorktreeStatus = {
  ...CTX_STATUS,
  branch: TENANT,
  workingTree: { kind: 'known', staged: 0, unstaged: 2, untracked: 0, unmerged: 0, changed: 2 },
};

describe('the branch menu on an Overview tile', () => {
  it('opens on a right click at the pointer, inside the window', async () => {
    seedCentralColumn({ kind: 'branches' });
    await show({ hasRail: false });

    fireEvent.contextMenu(screen.getByRole('link', { name: `Open ${TENANT}` }), {
      clientX: 240,
      clientY: 160,
    });

    const labels = await menuLabels();
    expect(labels.length).toBeGreaterThan(0);
    const menu = document.querySelector<HTMLElement>('[data-context-menu]');
    expect(menu?.style.left).toBe('240px');
    expect(menu?.style.top).toBe('160px');
  });

  it('opens the same list from Shift+F10 on the focused tile and from its dots', async () => {
    seedCentralColumn({ kind: 'branches' });
    await show({ hasRail: false });
    const link = screen.getByRole('link', { name: `Open ${TENANT}` });

    fireEvent.contextMenu(link);
    const fromClick = await menuLabels();
    await closeMenu();

    act(() => {
      link.focus();
    });
    fireEvent.keyDown(link, { key: 'F10', shiftKey: true });
    const fromKeys = await menuLabels();
    await closeMenu();

    fireEvent.click(within(tenantTile()).getByRole('button', { name: ACTIONS }));
    const fromDots = await menuLabels();

    expect(fromKeys).toEqual(fromClick);
    expect(fromDots.length).toBeLessThanOrEqual(5);
    expect(fromClick.filter((label) => fromDots.includes(label))).toEqual(fromDots);
  });

  it('lists the same actions as the rail row of the same branch', async () => {
    seedCentralColumn({ kind: 'branches' });
    await show({ hasRail: true });

    const dots = screen.getAllByRole('button', { name: ACTIONS });
    expect(dots).toHaveLength(2);
    const lists: Array<ReadonlyArray<string>> = [];
    for (const button of dots) {
      fireEvent.click(button);
      lists.push(await menuLabels());
      await closeMenu();
    }
    const [rail, overview] = lists;
    expect(overview).toEqual(rail);
    expect(overview?.length).toBeGreaterThan(0);
  });

  it('closes the branch from the Overview and keeps its uncommitted work, as the close says', async () => {
    seedCentralColumn({ kind: 'branches' });
    storySpies.tauriInvoke.mockImplementation((command, args) => {
      if (command === 'worktree_status') {
        return Promise.resolve(DIRTY_STATUS);
      }
      if (typeof command !== 'string') {
        throw new Error('The scene command must be a string.');
      }
      return sceneInvoke({ command, args });
    });
    const mount = tenantMount();
    const removeMountWorktree = vi.fn<AppStore['removeMountWorktree']>(pending);
    const unmountMount = vi.fn<AppStore['unmountMount']>(pending);
    act(() => {
      useAppStore.setState({ unmountMount, removeMountWorktree });
    });
    await show({ hasRail: false });

    fireEvent.contextMenu(screen.getByRole('link', { name: `Open ${TENANT}` }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Close branch/ }));
    const menu = document.querySelector<HTMLElement>('[data-context-menu]');
    if (menu === null) {
      throw new Error('The confirm must stay inside the menu.');
    }
    expect(menu.textContent).toContain('The 2 uncommitted changes stay on disk.');
    expect(screen.queryByRole('dialog')).toBeNull();
    const confirm = within(menu).getByRole('button', { name: 'Unmount anyway' });
    await act(async () => {
      fireEvent.click(confirm);
      await Promise.resolve();
    });

    await vi.waitFor(() =>
      expect(unmountMount).toHaveBeenCalledWith({
        sessionId: COLUMN_SESSION_ID,
        mountId: mount.mountId,
        keepDirectory: true,
      }),
    );
    expect(removeMountWorktree).not.toHaveBeenCalled();
  });

  it.each([
    { surface: 'Overview tile', hasRail: false, rowPrefix: 'board-mount-' },
    { surface: 'rail row', hasRail: true, rowPrefix: 'mount-' },
  ])(
    'moves the focus to the next branch after its $surface menu closes a branch',
    async ({ hasRail, rowPrefix }) => {
      seedCentralColumn({ kind: 'branches' });
      const mount = tenantMount();
      const survivor = (useAppStore.getState().sessionProjectMounts[COLUMN_SESSION_ID] ?? []).find(
        (candidate) => candidate.mountId !== mount.mountId,
      );
      const unmountMount = vi.fn<AppStore['unmountMount']>(async () => {
        useAppStore.setState((store) => ({
          sessionProjectMounts: {
            ...store.sessionProjectMounts,
            [COLUMN_SESSION_ID]: (store.sessionProjectMounts[COLUMN_SESSION_ID] ?? []).filter(
              (candidate) => candidate.mountId !== mount.mountId,
            ),
          },
        }));
        return {
          mount: {
            ...mount,
            id: mount.mountId,
            repoSlug: null,
            repoRoot: '/repos/payments-api',
            createdAt: TEST_NOW,
            updatedAt: TEST_NOW,
          },
          kept: false,
          reason: null,
        };
      });
      act(() => {
        useAppStore.setState({ unmountMount });
      });
      await show({ hasRail });

      const dots = screen.getAllByRole('button', { name: ACTIONS })[0];
      if (dots === undefined) {
        throw new Error('The row must show its dots.');
      }
      expect(dots.closest('[data-row]')?.getAttribute('data-row')).toBe(
        `${rowPrefix}${mount.mountId}`,
      );
      act(() => {
        dots.focus();
      });
      fireEvent.click(dots);
      fireEvent.click(await screen.findByRole('menuitem', { name: /Close branch/ }));
      const confirm = await screen.findByRole('button', { name: 'Unmount anyway' });
      await act(async () => {
        fireEvent.click(confirm);
        await Promise.resolve();
      });
      await settle();

      expect(unmountMount).toHaveBeenCalledWith({
        sessionId: COLUMN_SESSION_ID,
        mountId: mount.mountId,
        onKeptFolder: 'detach',
      });
      await vi.waitFor(() =>
        expect(document.activeElement?.closest('[data-row]')?.getAttribute('data-row')).toBe(
          `${rowPrefix}${survivor?.mountId ?? ''}`,
        ),
      );
    },
  );

  it('drops a menu opened before the branch left the session, and acts on nothing', async () => {
    seedCentralColumn({ kind: 'branches' });
    const mount = tenantMount();
    const unmountMount = vi.fn<AppStore['unmountMount']>(pending);
    act(() => {
      useAppStore.setState({ unmountMount });
    });
    await show({ hasRail: false });

    fireEvent.contextMenu(screen.getByRole('link', { name: `Open ${TENANT}` }));
    await menuLabels();
    act(() => {
      useAppStore.setState((store) => ({
        sessionProjectMounts: {
          ...store.sessionProjectMounts,
          [COLUMN_SESSION_ID]: (store.sessionProjectMounts[COLUMN_SESSION_ID] ?? []).filter(
            (candidate) => candidate.mountId !== mount.mountId,
          ),
        },
      }));
    });
    await settle();

    expect(screen.queryByRole('link', { name: `Open ${TENANT}` })).toBeNull();
    expect(document.querySelector('[data-context-menu]')).toBeNull();
    expect(unmountMount).not.toHaveBeenCalled();
  });
});
