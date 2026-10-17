// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { resetWorktreeStatusCache } from '../../../../../store/slices/worktreeStatuses/cache';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { sectionNames } from '../../../../../test/branchRail';
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

beforeAll(async () => {
  await importStore();
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

const worktreeLayer = (): HTMLElement => {
  const layer = document.querySelector<HTMLElement>('[data-level-layer="worktree"]:not([inert])');
  if (layer === null) {
    throw new Error('the scene is not on the worktree level');
  }
  return layer;
};

describe('the c04 worktree level scenes', () => {
  it('registers every scene in the mock registry', () => {
    for (const name of Object.keys(U25_C04_WORKTREE_SCENES)) {
      expect(MOCK_SCENES[name], name).toBeDefined();
    }
  });

  it('c04-session-worktrees lists three projects, a danger dot, and a merged branch inline', async () => {
    await mount('c04-session-worktrees');

    expect(screen.getByRole('list', { name: 'payments-api worktrees' })).toBeDefined();
    const ledger = within(screen.getByRole('list', { name: 'ledger-core worktrees' }));
    expect(
      ledger.getByRole('button', { name: /^ledger-core, / }).getAttribute('aria-label'),
    ).toContain('A check failed');
    const notify = within(screen.getByRole('list', { name: 'notify-relay worktrees' }));
    expect(notify.queryByRole('button', { name: /finished/ })).toBeNull();
    expect(
      notify
        .getByRole('button', { name: /^notify-relay, / })
        .querySelector('[data-pr-state]')
        ?.getAttribute('data-pr-state'),
    ).toBe('merged');
    expect(screen.getByRole('button', { name: 'Add to this session' })).toBeDefined();
  });

  it('c04-worktree-pr-behind shows identity, the status line with Rebase and the property block', async () => {
    await mount('c04-worktree-pr-behind');

    const level = within(worktreeLayer());
    expect(level.getByText('payments-api')).toBeDefined();
    expect(level.getByRole('status').textContent).toContain('6 behind main');
    expect(level.getByRole('button', { name: /^Rebase on main/ })).toBeDefined();
    expect(sectionNames()).toEqual(['Pull request', 'Comments', 'Files', 'Commits', 'Checks']);
    expect(screen.getByRole('group', { name: 'Properties' })).toBeDefined();
    expect(screen.getByTestId('pr-readiness').textContent).not.toBe('');
  });

  it('c04-worktree-pr-draft reads Draft in the entry and the State property', async () => {
    await mount('c04-worktree-pr-draft');

    expect(
      within(worktreeLayer()).getByRole('button', { name: 'Pull request, Draft' }),
    ).toBeDefined();
    expect(document.querySelector('[data-slot="branch-state"]')?.textContent).toBe('Draft');
  });

  it('c04-worktree-no-pr leaves the entry slot empty and offers the create form', async () => {
    await mount('c04-worktree-no-pr');

    expect(within(worktreeLayer()).getByRole('button', { name: 'Pull request' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Create pull request' })).toBeDefined();
  });

  it('c04-worktree-files selects Files and docks the file list on the right of the diff', async () => {
    await mount('c04-worktree-files');

    const files = within(worktreeLayer()).getByRole('button', { name: /^Files/ });
    expect(files.getAttribute('aria-current')).toBe('page');
    expect(files.hasAttribute('aria-expanded')).toBe(false);
    expect(within(worktreeLayer()).queryByRole('navigation', { name: 'Changed files' })).toBeNull();
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
    expect(within(toolbar).getByRole('button', { name: /^Files$/ })).toBeDefined();
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
    const comments = within(worktreeLayer()).getByRole('button', { name: /^Comments/ });
    expect(comments.getAttribute('aria-current')).toBe('page');
    expect(comments.textContent).toBe('Comments');
    expect(screen.queryByRole('tablist', { name: 'Comment source' })).toBeNull();
    cleanup();

    await mount('c04-worktree-checks');
    expect(
      within(worktreeLayer())
        .getByRole('button', { name: /^Checks/ })
        .getAttribute('aria-current'),
    ).toBe('page');
  });

  it('c04-worktree-rebasing says the rebase on the status line with Abort', async () => {
    await mount('c04-worktree-rebasing');

    const line = within(worktreeLayer()).getByRole('status');
    expect(line.textContent).toContain('Rebasing · 1 conflict');
    expect(within(worktreeLayer()).getByRole('button', { name: 'Abort rebase' })).toBeDefined();
  });

  it('c04-worktree-menu opens the worktree menu', async () => {
    await mount('c04-worktree-menu');

    expect(screen.getByRole('menuitem', { name: /Link work to this branch/ })).toBeDefined();
  });

  it('c04-worktree-folded shows the worktree entries as session rail icons', async () => {
    await mount('c04-worktree-folded');

    const rail = document.querySelector('[data-session-rail]');
    expect(rail?.getAttribute('data-session-rail')).toBe('worktree');
    expect(rail?.hasAttribute('data-rail-folded')).toBe(true);
    expect(rail?.querySelector('[data-rail-level="worktree"]')).not.toBeNull();
    expect(document.querySelector('[data-column-layer="nav"]')).not.toBeNull();
  });
});
