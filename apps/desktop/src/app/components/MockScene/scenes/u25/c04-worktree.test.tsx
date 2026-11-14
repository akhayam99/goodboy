// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { resetWorktreeStatusCache } from '../../../../../store/runtime/worktreeStatuses/cache';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { stripNames, stripTab } from '../../../../../test/branchTabStrip';
import { MOCK_SCENES } from '../..';
import { U25_C04_WORKTREE_SCENES } from './c04-worktree';

const SETTLE_MS = 2_000;
const NARROW_PANE_PX = 820;

type ObserverCallback = (entries: ReadonlyArray<{ contentRect: { width: number } }>) => void;

class NarrowBranchPane {
  private readonly callback: ObserverCallback;
  constructor(callback: ObserverCallback) {
    this.callback = callback;
  }
  observe(target: Element) {
    if (target.hasAttribute('data-branch-pane')) {
      this.callback([{ contentRect: { width: NARROW_PANE_PX } }]);
    }
  }
  unobserve() {}
  disconnect() {}
}

type SceneName = keyof typeof U25_C04_WORKTREE_SCENES;

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  resetWorktreeStatusCache();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  cleanup();
  clearSceneInvoke();
});

const mount = async (name: SceneName): Promise<void> => {
  const Scene = U25_C04_WORKTREE_SCENES[name];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
  expect(screen.queryByText('Something went wrong')).toBeNull();
};

describe('the c04 worktree level scenes', () => {
  it('registers every scene in the mock registry', () => {
    for (const name of Object.keys(U25_C04_WORKTREE_SCENES)) {
      expect(MOCK_SCENES[name], name).toBeDefined();
    }
  });

  it('c04-session-worktrees lists three folders, a failing chip, and the merged branch in the fold', async () => {
    await mount('c04-session-worktrees');

    expect(screen.getByRole('list', { name: 'payments-api worktrees' })).toBeDefined();
    const ledger = within(screen.getByRole('list', { name: 'ledger-core worktrees' }));
    expect(ledger.getByRole('button', { name: /#77/ }).textContent).toContain('Checks failing');
    const notify = document.querySelector<HTMLElement>('[data-card-project="notify-relay"]');
    expect(notify?.querySelector('[data-finished-fold]')?.textContent).toBe('1 finished');
    expect(screen.getByRole('button', { name: 'Add project' })).toBeDefined();
  });

  it('c04-worktree-pr-behind shows the session page tabs, the property block, no status line', async () => {
    await mount('c04-worktree-pr-behind');

    expect(screen.getByRole('tablist', { name: 'Session pages' })).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Rebase on main/ })).toBeNull();
    expect(stripNames()).toEqual(['Overview', 'Comments', 'Changes', 'Commits', 'Checks', 'Work']);
    expect(screen.getByRole('group', { name: 'Properties' })).toBeDefined();
    expect(screen.getByRole('region', { name: 'Merge status' }).textContent).toContain(
      '6 commits behind main',
    );
  });

  it('c04-worktree-pr-draft reads Draft in the entry and the State property', async () => {
    await mount('c04-worktree-pr-draft');

    expect(stripTab({ name: /^Overview/ }).textContent).toBe('OverviewDraft');
    expect(document.querySelector('[data-slot="branch-state"]')?.textContent).toBe('Draft');
  });

  it('c04-worktree-no-pr leaves the entry slot empty and offers the create form', async () => {
    await mount('c04-worktree-no-pr');

    expect(stripTab({ name: /^Overview/ }).textContent).toBe('Overview');
    expect(screen.getByRole('button', { name: /create pull request$/i })).toBeDefined();
  });

  it('c04-worktree-no-pr-fix keeps one fill when a fixable note comes with the create form', async () => {
    await mount('c04-worktree-no-pr-fix');

    const step = document.querySelector('[data-branch-primary]');
    expect(step?.textContent).toMatch(/^Fix 1 comment/);
    fireEvent.click(step ?? document.body);
    const drawer = useAppStore.getState().drawer;
    expect(drawer?.kind === 'fix-comments' ? drawer.payload.threadIds : []).toHaveLength(1);
    expect(step?.getAttribute('data-variant')).toBe('secondary');
    expect(document.querySelectorAll('button[data-variant="primary"]')).toHaveLength(1);
  });

  it('c04-worktree-files selects Changes and docks the file list on the right of the diff', async () => {
    await mount('c04-worktree-files');

    expect(stripTab({ name: /^Changes/ }).getAttribute('aria-selected')).toBe('true');
    const rail = screen.getByRole('complementary', { name: 'Files' });
    expect(rail.getAttribute('data-file-rail')).toBe('docked');
    expect(within(rail).getByRole('navigation', { name: 'Changed files' })).toBeDefined();
  });

  it('c04-worktree-files-folded folds the file list and offers Files in the diff toolbar', async () => {
    await mount('c04-worktree-files-folded');

    expect(screen.queryByRole('complementary', { name: 'Files' })).toBeNull();
    const toolbar = document.querySelector<HTMLElement>('[data-slot="diff-toolbar"]');
    if (toolbar === null) {
      throw new Error('the folded scene draws no diff toolbar');
    }
    expect(within(toolbar).getAllByRole('button')[0]?.textContent).toBe('Files6+53 -24');
    expect(screen.queryByText('Split needs a wider window')).toBeNull();
  });

  it('c04-worktree-files-narrow opens the file list over the diff of a narrow page', async () => {
    vi.stubGlobal('ResizeObserver', NarrowBranchPane);
    await mount('c04-worktree-files-narrow');

    const rail = screen.getByRole('complementary', { name: 'Files' });
    expect(rail.getAttribute('data-file-rail')).toBe('overlay');
    expect(within(rail).getByRole('navigation', { name: 'Changed files' })).toBeDefined();
    vi.unstubAllGlobals();
  });

  it('c04-worktree-comments and c04-worktree-checks select their entry', async () => {
    await mount('c04-worktree-comments');
    const comments = stripTab({ name: /^Comments/ });
    expect(comments.getAttribute('aria-selected')).toBe('true');
    expect(comments.querySelector('[data-tab-count]')?.textContent).toBe('9');
    expect(screen.queryByRole('tablist', { name: 'Comment source' })).toBeNull();
    cleanup();

    await mount('c04-worktree-checks');
    expect(stripTab({ name: /^Checks/ }).getAttribute('aria-selected')).toBe('true');
  });

  it('c04-worktree-rebasing says the stopped rebase in one pill', async () => {
    await mount('c04-worktree-rebasing');

    expect(document.querySelector('[data-chip-kind="conflict"]')?.textContent).toBe(
      'Rebase stopped',
    );
  });
});
