// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../shared/components/Toast';
import { STORE_IMPORT_TIMEOUT_MS, importStore, resetStoryStore } from '../../store/storyHarness';
import { resetWorktreeStatusCache } from '../../store/slices/worktreeStatuses/cache';
import { clearSceneInvoke } from '../../test/sceneInvoke';
import { BRANCH_TAB_REGISTRY } from '../../features/branch/branchTabs';
import { U25_C04_WORKTREE_SCENES } from '../../app/components/MockScene/scenes/u25/c04-worktree';

const SETTLE_MS = 2_000;

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
  vi.useRealTimers();
  cleanup();
  clearSceneInvoke();
});

const advance = async (): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
};

const mount = async (name: SceneName): Promise<void> => {
  const Scene = U25_C04_WORKTREE_SCENES[name];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await advance();
};

const level = () => {
  const layer = document.querySelector<HTMLElement>('[data-level-layer="worktree"]:not([inert])');
  if (layer === null) {
    throw new Error('the scene is not on the worktree level');
  }
  return within(layer);
};

const entry = async (name: RegExp): Promise<void> => {
  fireEvent.click(level().getByRole('button', { name }));
  await advance();
};

const worktreeMenu = async (): Promise<ReadonlyArray<string>> => {
  fireEvent.click(level().getByRole('button', { name: /actions$/ }));
  await advance();
  return screen.getAllByRole('menuitem').map((item) => item.textContent ?? '');
};

const branchMenu = async (): Promise<ReadonlyArray<string>> => {
  fireEvent.click(screen.getByRole('button', { name: 'Branch actions' }));
  await advance();
  return screen.getAllByRole('menuitem').map((item) => item.textContent ?? '');
};

describe('SPEC3 9.6 Branch page capabilities from the worktree level', () => {
  it('section keys stay on the entries: Pull request, Comments and Files carry their shortcut', async () => {
    await mount('c04-worktree-pr-behind');

    for (const name of [/^Pull request/, /^Comments/, /^Files/]) {
      expect(level().getByRole('button', { name })).toBeDefined();
    }
    expect(BRANCH_TAB_REGISTRY.pr.shortcut).toBe('lens.pr');
    expect(BRANCH_TAB_REGISTRY.comments.shortcut).toBe('lens.review');
    expect(BRANCH_TAB_REGISTRY.files.shortcut).toBe('lens.files');
  });

  it('the branch switcher opens from the identity row with New branch', async () => {
    await mount('c04-worktree-pr-draft');

    fireEvent.click(level().getByTestId('branch-switcher'));
    await advance();

    expect(
      screen.queryByRole('menuitem', { name: 'New branch' }) ??
        screen.queryByRole('textbox', { name: 'Branch name' }),
    ).not.toBeNull();
  });

  it('the pull request title edits in place from the page title', async () => {
    await mount('c04-worktree-pr-draft');

    fireEvent.click(screen.getByTitle('Edit title (E)'));

    expect(screen.getByRole('textbox', { name: 'Pull request title' })).toBeDefined();
  });

  it('the header primary follows the state: Mark ready for review on a draft', async () => {
    await mount('c04-worktree-pr-draft');

    expect(document.querySelector('[data-branch-primary="pullRequest.markReady"]')).not.toBeNull();
  });

  it('merge readiness reads in words in the Readiness property', async () => {
    await mount('c04-worktree-pr-behind');

    expect(screen.getByTestId('pr-readiness').textContent).toMatch(/[A-Za-z]/);
  });

  it('the Branch actions menu keeps Close pull request, the worktree menu the branch actions', async () => {
    await mount('c04-worktree-pr-draft');

    const labels = await branchMenu();
    expect(labels.some((label) => /Close pull request/.test(label))).toBe(true);
    expect(labels.some((label) => /Copy branch name/.test(label))).toBe(false);
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    await advance();

    fireEvent.click(level().getByRole('button', { name: / actions$/ }));
    await advance();
    const worktree = screen.getAllByRole('menuitem').map((item) => item.textContent ?? '');
    expect(worktree.some((label) => /Copy branch name/.test(label))).toBe(true);
  });

  it('a stopped rebase keeps Abort on the status line, its one home', async () => {
    await mount('c04-worktree-rebasing');

    expect(level().getByRole('button', { name: 'Abort rebase' })).toBeDefined();
    const labels = await branchMenu();
    expect(labels.some((label) => /Abort rebase/.test(label))).toBe(false);
  });

  it('Rebase has one home, the status line, while the branch is behind', async () => {
    await mount('c04-worktree-pr-behind');

    expect(level().getByRole('button', { name: /^Rebase on main/ })).toBeDefined();
    expect(
      within(screen.getByRole('group', { name: 'Properties' })).queryByRole('button', {
        name: /Rebase/,
      }),
    ).toBeNull();
  });

  it('no pull request yet keeps Create pull request and Write it', async () => {
    await mount('c04-worktree-no-pr');

    expect(screen.getByRole('button', { name: 'Create pull request' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Write with Scribe' })).toBeDefined();
  });

  it('the description edits in place and reviewers keep Request review', async () => {
    await mount('c04-worktree-pr-draft');

    const description = screen.getByRole('region', { name: 'Description' });
    expect(within(description).getByRole('button', { name: 'Edit' })).toBeDefined();
    expect(screen.getByRole('region', { name: 'Reviewers' })).toBeDefined();
  });

  it('Comments keeps its groups from its entry', async () => {
    await mount('c04-worktree-comments');

    expect(
      level()
        .getByRole('button', { name: /^Comments/ })
        .getAttribute('aria-current'),
    ).toBe('page');
    expect(screen.queryByRole('region', { name: 'Description' })).toBeNull();
  });

  it('Files keeps the tree with its filter in the file rail on the right of the diff', async () => {
    await mount('c04-worktree-files');

    const rail = within(screen.getByRole('complementary', { name: 'Files' }));
    expect(rail.getByRole('navigation', { name: 'Changed files' })).toBeDefined();
    expect(rail.getByRole('searchbox', { name: 'Filter files' })).toBeDefined();
    expect(rail.getByRole('button', { name: 'Filter and group files' })).toBeDefined();
    expect(rail.getByRole('button', { name: /^Next unviewed/ })).toBeDefined();
    expect(level().queryByRole('navigation', { name: 'Changed files' })).toBeNull();
  });

  it('Commits and Checks open their bodies from their entries', async () => {
    await mount('c04-worktree-pr-behind');

    await entry(/^Commits/);
    expect(
      level()
        .getByRole('button', { name: /^Commits/ })
        .getAttribute('aria-current'),
    ).toBe('page');
    await entry(/^Checks/);
    expect(screen.getByRole('region', { name: 'Checks' })).toBeDefined();
  });
});

describe('SPEC3 9.3 worktree actions from the worktree level', () => {
  it('the worktree menu holds Switch branch, Link work to this branch, copy and editor actions', async () => {
    await mount('c04-worktree-pr-draft');

    const labels = await worktreeMenu();

    for (const word of [
      /Switch branch/,
      /Link work to this branch/,
      /Copy branch name/,
      /Copy path/,
      /Open in/,
    ]) {
      expect(
        labels.some((label) => word.test(label)),
        String(word),
      ).toBe(true);
    }
  });

  it('Switch branch opens the switch panel under the identity row', async () => {
    await mount('c04-worktree-pr-draft');

    await worktreeMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /Switch branch/ }));
    await advance();

    expect(screen.getByRole('dialog', { name: 'Switch branch' })).toBeDefined();
  });

  it('Add folder on the card and New branch on each repo row stay one click away', async () => {
    await mount('c04-session-worktrees');

    fireEvent.click(screen.getByRole('button', { name: 'Add folder' }));
    await advance();
    const picker = within(screen.getByRole('dialog', { name: 'Add folder' }));
    expect(picker.getByRole('button', { name: 'Connect a repo or folder' })).toBeDefined();
    fireEvent.keyDown(window, { key: 'Escape' });
    await advance();

    fireEvent.click(screen.getByRole('button', { name: 'New branch in payments-api' }));
    await advance();
    expect(screen.getByRole('dialog', { name: 'New branch in payments-api' })).toBeDefined();
  });
});
