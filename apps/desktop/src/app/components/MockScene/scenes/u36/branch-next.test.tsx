// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { brandId } from '@goodboy/types';
import { ToastProvider } from '../../../../../shared/components/Toast';
import type { TerminalTabId } from '../../../../../shared/types/terminal';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import { SESSION } from '../resolveSeed';
import { PR_PAGE_WORKTREE } from '../u23/prPageSeed';
import { U36_BRANCH_NEXT_SCENES } from './branch-next';

type StoreState = ReturnType<StoryStore['getState']>;

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  installFakeResizeObserver();
  await resetStoryStore();
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

type MountParams = {
  readonly id: string;
};

const mount = ({ id }: MountParams) => {
  const Scene = U36_BRANCH_NEXT_SCENES[id];
  if (Scene === undefined) {
    throw new Error(`no scene ${id}`);
  }
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const confirmPanel = ({ title }: { readonly title: HTMLElement }): HTMLElement =>
  title.closest<HTMLElement>('[role="group"]') ?? document.body;

const headerStep = (): HTMLElement | null =>
  document.querySelector<HTMLElement>('[data-branch-primary]');

describe('the u36 branch next step scenes', () => {
  it('registers each scene', () => {
    for (const id of Object.keys(U36_BRANCH_NEXT_SCENES)) {
      expect(MOCK_SCENES[id]).toBeDefined();
    }
  });

  it('leads with Fix checks while a check fails and nothing runs', async () => {
    mount({ id: 'u36-p16-fix-checks' });

    await waitFor(() => expect(headerStep()?.textContent).toBe('Fix checks'));
    expect(screen.queryByTestId('branch-check-work')).toBeNull();
  });

  it('draws no fill and one line with Stop while the Debugger works', async () => {
    mount({ id: 'u36-p16-checks-working' });

    const line = await screen.findByTestId('branch-check-work');
    expect(line.textContent).toMatch(/^Analyzing /);
    screen.getByRole('button', { name: 'Stop' });
    expect(headerStep()).toBeNull();
  });

  it('moves on to Start fix once the Debugger proposed one', async () => {
    mount({ id: 'u36-p16-start-fix' });

    await waitFor(() => expect(headerStep()?.textContent).toBe('Start fix'));
  });

  it('ends a merged branch with Remove worktree while the folder is there', async () => {
    mount({ id: 'u36-p16-merged-remove' });

    await waitFor(() => expect(headerStep()?.textContent).toBe('Remove worktree'));
  });

  it('shows a blocked Remove disabled with its reason, and no jump to Archive', async () => {
    const store = await importStore();
    mount({ id: 'u36-p16-merged-remove' });
    await waitFor(() => expect(headerStep()?.textContent).toBe('Remove worktree'));

    act(() => {
      store.setState({
        terminalTabs: {
          [SESSION.id]: [
            {
              id: brandId<TerminalTabId>({ value: 'terminal-1' }),
              owner: { kind: 'session', sessionId: SESSION.id },
              title: 'zsh',
              cwd: PR_PAGE_WORKTREE,
              status: 'running',
              createdAt: 1,
            },
          ],
        },
      });
    });

    await waitFor(() => expect(headerStep()).toBeNull());
    const remove = document.querySelector<HTMLButtonElement>(
      '[data-branch-secondary="diff.removeWorktree"]',
    );
    expect(remove?.textContent).toBe('Remove worktree');
    expect(remove?.disabled).toBe(true);
    fireEvent.mouseEnter(remove?.parentElement ?? document.body);
    await screen.findByText(/terminal/i);
  });

  it('keeps Remove and offers Archive session in the menu when Remove refuses', async () => {
    const store = await importStore();
    const runAfterMergeCleanup = vi.fn<StoreState['runAfterMergeCleanup']>(async () => ({
      kind: 'ask',
      keptBecause: "Kept hl/fix-duplicate-credit: Goodboy didn't create it.",
    }));
    const bulkArchiveTask = vi.fn(async () => ({ succeeded: [SESSION.id], failed: [] }));
    mount({ id: 'u36-p16-merged-remove' });
    await waitFor(() => expect(headerStep()?.textContent).toBe('Remove worktree'));
    store.setState({ runAfterMergeCleanup, bulkArchiveTask });

    fireEvent.click(screen.getByRole('button', { name: 'Remove worktree' }));
    const panel = confirmPanel({ title: await screen.findByText('Remove the worktree?') });
    fireEvent.click(within(panel).getByRole('button', { name: 'Remove worktree' }));

    await screen.findByText(/Goodboy didn't create it/);
    expect(headerStep()?.textContent).toBe('Remove worktree');
    fireEvent.click(screen.getByRole('button', { name: 'Branch actions' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Archive session/ }));

    await waitFor(() => expect(bulkArchiveTask).toHaveBeenCalledWith([SESSION.id]));
  });

  it('follows Remove with Archive session once the last folder is gone', async () => {
    mount({ id: 'u36-p16-merged-archive' });

    await waitFor(() => expect(headerStep()?.textContent).toBe('Archive session'));
  });

  it('asks once, archives the session, and keeps the step when the archive fails', async () => {
    const store = await importStore();
    const bulkArchiveTask = vi.fn(async () => ({ succeeded: [], failed: [SESSION.id] }));
    mount({ id: 'u36-p16-merged-archive' });
    await waitFor(() => expect(headerStep()?.textContent).toBe('Archive session'));
    store.setState({ bulkArchiveTask });

    fireEvent.click(screen.getByRole('button', { name: 'Archive session' }));
    const panel = confirmPanel({ title: await screen.findByText('Archive session?') });
    fireEvent.click(within(panel).getByRole('button', { name: 'Archive session' }));

    await waitFor(() => expect(bulkArchiveTask).toHaveBeenCalledWith([SESSION.id]));
    expect(headerStep()?.textContent).toBe('Archive session');
  });
});
