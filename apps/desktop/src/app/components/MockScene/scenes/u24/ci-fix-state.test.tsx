// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { BranchCommit } from '@goodboy/types';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { sceneInvoke, clearSceneInvoke } from '../../../../../test/sceneInvoke';
import {
  refreshWorktreeStatuses,
  resetWorktreeStatusCache,
} from '../../../../../store/slices/worktreeStatuses/cache';
import { mockSceneIpc } from '../mockSceneIpc';
import { U24_CI_FIX_STATE_SCENES } from './ci-fix-state';

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
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
afterEach(() => {
  cleanup();
});

type Params = { readonly name: string };
const show = ({ name }: Params) => {
  const Scene = U24_CI_FIX_STATE_SCENES[name];
  if (Scene === undefined) {
    throw new Error('Unknown CI fix state scene');
  }
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const nextCard = () => screen.getByRole('region', { name: 'Next' });

describe('CI fix state scenes', () => {
  it('labels the checks row as fixed and not pushed and offers Push', () => {
    show({ name: 'checks-fixed-local' });
    expect(screen.getByText('Fixed, not pushed')).toBeDefined();
    expect(screen.queryByText('The fix stopped')).toBeNull();
    expect(screen.getByRole('button', { name: 'Open' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Push' })).toBeDefined();
  });
  it('pushes from the checks row once and moves the row to re-running', async () => {
    store.setState({
      refreshSessionPr: async () => undefined,
      loadSessionMounts: async () => [],
    });
    show({ name: 'checks-fixed-local' });
    const pushes: Array<unknown> = [];
    let isPushed = false;
    mockSceneIpc((command, payload) => {
      if (command === 'worktree_commits') {
        return [
          {
            sha: '9e4c1a7d3b5f60718293a4b5c6d7e8f901234567',
            shortSha: '9e4c1a7',
            subject: 'Guard the retry against double credits',
            author: 'Acme Dev',
            timestamp: Math.floor(Date.now() / 1_000) + 3_600,
            pushed: isPushed,
            parentSha: null,
          },
        ];
      }
      if (command === 'git_push') {
        pushes.push(payload);
        isPushed = true;
        return { stdout: '', stderr: '', exitCode: 0 };
      }
      return null;
    });
    const button = screen.getByRole('button', { name: 'Push' });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(screen.getByText('Pushed, re-running')).toBeDefined());
    expect(pushes).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Push' })).toBeNull();
  });
  it('keeps Push on the checks row and reports the error when the push fails', async () => {
    const reportError = vi.fn(async (_params: unknown) => undefined);
    store.setState({
      refreshSessionPr: async () => undefined,
      loadSessionMounts: async () => [],
      reportError,
    });
    show({ name: 'checks-fixed-local' });
    mockSceneIpc((command) => {
      if (command === 'git_push') {
        return { stdout: '', stderr: 'rejected: non-fast-forward', exitCode: 1 };
      }
      if (command === 'worktree_commits') {
        return [
          {
            sha: '9e4c1a7d3b5f60718293a4b5c6d7e8f901234567',
            shortSha: '9e4c1a7',
            subject: 'Guard the retry against double credits',
            author: 'Acme Dev',
            timestamp: Math.floor(Date.now() / 1_000) + 3_600,
            pushed: false,
            parentSha: null,
          },
        ];
      }
      return null;
    });
    fireEvent.click(screen.getByRole('button', { name: 'Push' }));
    await waitFor(() =>
      expect(reportError).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Couldn't push the branch" }),
      ),
    );
    expect(screen.getByText('Fixed, not pushed')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Push' })).toBeDefined();
  });
  it('leads the drawer with the outcome, Push as its one primary and the steps as rows', () => {
    show({ name: 'debugger-drawer-fixed-local' });
    const drawer = screen.getByRole('region', { name: 'Debugger' });
    expect(within(drawer).getByText('payments-api / test is fixed on your branch')).toBeDefined();
    expect(
      within(drawer).getByText(
        'Committed 9e4c1a7 on the branch, not pushed yet. Push it so the check runs again.',
      ),
    ).toBeDefined();
    expect(within(drawer).queryByText(/is running again|Pushed 9e4c1a7/)).toBeNull();
    const primaries = drawer.querySelectorAll('[data-variant="primary"]');
    expect(primaries).toHaveLength(1);
    expect(primaries[0]?.textContent).toBe('Push');
    const chain = within(drawer).getByRole('list', { name: 'Agent chain' });
    expect(within(chain).getAllByRole('listitem')).toHaveLength(3);
    expect(within(chain).getByText('Needs you')).toBeDefined();
    expect(within(drawer).queryByRole('heading', { level: 3, name: 'Activity' })).toBeNull();
    for (const name of ['Finding', 'Proposed fix', 'What it was given', 'Failed log tail']) {
      expect(within(drawer).getByRole('button', { name }).getAttribute('aria-expanded')).toBe(
        'false',
      );
    }
  });
  it('pushes from the drawer and then reads the three green steps and the check', async () => {
    store.setState({
      refreshSessionPr: async () => undefined,
      loadSessionMounts: async () => [],
    });
    show({ name: 'debugger-drawer-fixed-local' });
    let isPushed = false;
    mockSceneIpc((command) => {
      if (command === 'worktree_commits') {
        return [
          {
            sha: '9e4c1a7d3b5f60718293a4b5c6d7e8f901234567',
            shortSha: '9e4c1a7',
            subject: 'Guard the retry against double credits',
            author: 'Acme Dev',
            timestamp: Math.floor(Date.now() / 1_000) + 3_600,
            pushed: isPushed,
            parentSha: null,
          },
        ];
      }
      if (command === 'git_push') {
        isPushed = true;
        return { stdout: '', stderr: '', exitCode: 0 };
      }
      return null;
    });
    const drawer = screen.getByRole('region', { name: 'Debugger' });
    fireEvent.click(within(drawer).getByRole('button', { name: 'Push' }));
    await waitFor(() =>
      expect(within(drawer).getByText('payments-api / test is running again')).toBeDefined(),
    );
    const chain = within(drawer).getByRole('list', { name: 'Agent chain' });
    expect(within(chain).getAllByRole('listitem')).toHaveLength(4);
    expect(within(chain).queryByText('Needs you')).toBeNull();
    expect(within(drawer).queryByRole('button', { name: 'Push' })).toBeNull();
  });
  it('keeps the seeded projects and one model for the CI fix in the Activity scene', async () => {
    show({ name: 'activity-check-fixed-local' });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    const body = document.body.textContent ?? '';
    expect(body).toContain('hl/fix-duplicate-credit');
    expect(body).not.toContain('No project yet');
    const [title] = screen.getAllByText('CI fix · payments-api / test · #318');
    let row: HTMLElement | null = title?.parentElement ?? null;
    while (row !== null && !(row.textContent ?? '').includes('Analyze done')) {
      row = row.parentElement;
    }
    expect(row?.textContent).toContain('Sonnet 5.5');
    expect(row?.textContent).not.toContain('Composer 2.5');
  });
  it('turns the Next card into a success card with Push', () => {
    show({ name: 'activity-check-fixed-local' });
    const card = nextCard();
    expect(within(card).getByText('payments-api / test is fixed on your branch')).toBeDefined();
    expect(
      within(card).getByText('1 commit is ready. Push it so the check runs again.'),
    ).toBeDefined();
    expect(within(card).getByRole('button', { name: 'Push' })).toBeDefined();
    expect(within(card).queryByRole('button', { name: 'Open' })).toBeNull();
    expect(screen.queryByText('Review the changes')).toBeNull();
  });
  it('pushes from the card and then says the check is running again', async () => {
    let isPushed = false;
    const pushes: Array<unknown> = [];
    store.setState({
      refreshSessionPr: async () => undefined,
      loadSessionMounts: async () => [],
    });
    show({ name: 'activity-check-fixed-local' });
    const commits = (): ReadonlyArray<BranchCommit> => [
      {
        sha: '9e4c1a7d3b5f60718293a4b5c6d7e8f901234567',
        shortSha: '9e4c1a7',
        subject: 'Guard the retry against double credits',
        author: 'Acme Dev',
        timestamp: Math.floor(Date.now() / 1_000) + 3_600,
        pushed: isPushed,
        parentSha: null,
      },
    ];
    mockSceneIpc((command, payload) => {
      if (command === 'worktree_commits') {
        return commits();
      }
      if (command === 'git_push') {
        pushes.push(payload);
        isPushed = true;
        return { stdout: '', stderr: '', exitCode: 0 };
      }
      return null;
    });
    fireEvent.click(within(nextCard()).getByRole('button', { name: 'Push' }));
    await waitFor(() =>
      expect(
        within(nextCard()).getByText('payments-api / test is running again on #318'),
      ).toBeDefined(),
    );
    expect(pushes).toHaveLength(1);
    expect(within(nextCard()).queryByRole('button', { name: 'Push' })).toBeNull();
    expect(within(nextCard()).getByText('payments-api · 1 commit pushed')).toBeDefined();
  });
  it('moves to pushed when the branch is pushed from somewhere else', async () => {
    let isPushed = false;
    show({ name: 'activity-check-fixed-local' });
    const worktreePaths = Object.values(store.getState().sessionProjectMounts)
      .flat()
      .map((mount) => mount.worktreePath);
    mockSceneIpc((command) => {
      if (command === 'worktree_commits') {
        return [
          {
            sha: '9e4c1a7d3b5f60718293a4b5c6d7e8f901234567',
            shortSha: '9e4c1a7',
            subject: 'Guard the retry against double credits',
            author: 'Acme Dev',
            timestamp: Math.floor(Date.now() / 1_000) + 3_600,
            pushed: isPushed,
            parentSha: null,
          },
        ];
      }
      if (command === 'worktree_status') {
        return {
          branch: 'hl/fix-duplicate-credit',
          head: isPushed ? 'after-push' : 'before-push',
          headSubject: null,
          upstream: 'origin/hl/fix-duplicate-credit',
          upstreamDistance: { kind: 'known', ahead: isPushed ? 0 : 1, behind: 0 },
          mainDistance: { kind: 'known', ahead: 1, behind: 0 },
          workingTree: {
            kind: 'known',
            staged: 0,
            unstaged: 0,
            untracked: 0,
            unmerged: 0,
            changed: 0,
          },
          inProgress: null,
        };
      }
      return null;
    });
    await refreshWorktreeStatuses({ worktreePaths });
    isPushed = true;
    await refreshWorktreeStatuses({ worktreePaths });
    await waitFor(() =>
      expect(
        within(nextCard()).getByText('payments-api / test is running again on #318'),
      ).toBeDefined(),
    );
  });
  it('keeps the card on Push and shows the error when the push fails', async () => {
    const reportError = vi.fn(async (_params: unknown) => undefined);
    store.setState({
      refreshSessionPr: async () => undefined,
      loadSessionMounts: async () => [],
      reportError,
    });
    show({ name: 'activity-check-fixed-local' });
    mockSceneIpc((command) => {
      if (command === 'git_push') {
        return { stdout: '', stderr: 'rejected: non-fast-forward', exitCode: 1 };
      }
      if (command === 'worktree_commits') {
        return [];
      }
      return null;
    });
    fireEvent.click(within(nextCard()).getByRole('button', { name: 'Push' }));
    await waitFor(() =>
      expect(reportError).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Couldn't push the branch" }),
      ),
    );
    expect(
      within(nextCard()).getByText('payments-api / test is fixed on your branch'),
    ).toBeDefined();
    expect(within(nextCard()).getByRole('button', { name: 'Push' })).toBeDefined();
  });
  it.each(Object.keys(U24_CI_FIX_STATE_SCENES))(
    '%s has no accessibility violations',
    async (name) => {
      const { container } = show({ name });
      const { violations } = await runA11yCheck(container);
      expect(violations.map((violation) => violation.id)).toEqual([]);
    },
  );
});
