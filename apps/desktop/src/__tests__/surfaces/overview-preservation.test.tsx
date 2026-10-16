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
import { installFakeResizeObserver } from '../../test/fakeResizeObserver';
import { STORE_IMPORT_TIMEOUT_MS, importStore, resetStoryStore } from '../../store/storyHarness';
import type { StoryStore } from '../../store/storyHarness';
import { resetWorktreeStatusCache } from '../../store/slices/worktreeStatuses/cache';
import { clearSceneInvoke } from '../../test/sceneInvoke';
import { MOCK_SCENES } from '../../app/components/MockScene';
import { MountsScene } from '../../app/components/MockScene/scenes/MountsScene';

const SETTLE_MS = 2_000;

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  installFakeResizeObserver();
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

type SceneParams = {
  readonly name: string;
};

const mountScene = async ({ name }: SceneParams): Promise<void> => {
  const Scene = MOCK_SCENES[name];
  if (Scene === undefined) {
    throw new Error(`${name} is not a registered scene`);
  }
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await advance();
};

const header = () => {
  const node = document.querySelector<HTMLElement>('[data-slot="pane-header"]');
  if (node === null) {
    throw new Error('no Overview header');
  }
  return within(node);
};

type PresentParams = {
  readonly value: HTMLElement | null | undefined;
  readonly what: string;
};

const present = ({ value, what }: PresentParams): HTMLElement => {
  if (value === null || value === undefined) {
    throw new Error(`no ${what}`);
  }
  return value;
};

const notices = () => within(screen.getByRole('region', { name: 'Notices' }));

describe('SPEC3 9.3 Overview capabilities from the c05 Overview', () => {
  it('shows the goal as prose and opens it in the Context drawer', async () => {
    await mountScene({ name: 'c05-overview-merged-next' });

    fireEvent.click(screen.getByRole('button', { name: /^Goal: Split the ledger/ }));
    await advance();

    expect(useAppStore.getState().drawer?.kind).toBe('context');
  });

  it('offers Add a goal and the quiet start on a blank session', async () => {
    await mountScene({ name: 'c05-overview-blank' });

    screen.getByRole('button', { name: 'Add a goal' });
    header().getByRole('button', { name: 'New' });
  });

  it('keeps the chat provenance line under the goal', async () => {
    await mountScene({ name: 'overview-header-provenance' });

    screen.getByRole('button', { name: /From chat: Payments retry design/ });
  });

  it('keeps Write title and goal from linked work in the header and Context in the session tools', async () => {
    await mountScene({ name: 'c05-overview-merged-next' });

    header().getByRole('button', { name: 'Write title and goal from linked work' });
    within(screen.getByRole('group', { name: 'Session tools' })).getByRole('button', {
      name: /^Context/,
    });
  });

  it('turns a mount cleanup proposal into a Next row with Remove worktree and an undoable Not now', async () => {
    await mountScene({ name: 'c05-overview-merged-next' });
    const row = screen
      .getByRole('region', { name: 'Next' })
      .querySelector<HTMLElement>(
        '[data-testid="next-step-close-worktree:mock-mount-ledger-rounding"]',
      );
    expect(row).not.toBeNull();

    fireEvent.click(
      within(present({ value: row, what: 'the cleanup row' })).getByRole('button', {
        name: 'Not now',
      }),
    );
    await advance();

    expect(screen.queryByText('Remove the ledger-core worktree')).toBeNull();
    screen.getByText('Dismissed');
  });

  it('keeps the branch drift decision in the notices slot', async () => {
    await mountScene({ name: 'c05-overview-notices' });

    notices().getByRole('button', { name: 'Use this branch here' });
    notices().getByRole('button', { name: 'Keep both branches' });
  });

  it('keeps Restore branch and Remove for a deleted branch in the notices slot', async () => {
    await mountScene({ name: 'c05-overview-notices' });

    notices().getByRole('button', { name: /^Restore branch for/ });
    notices().getByRole('button', { name: /^Remove for/ });
  });

  it('keeps Reopen on a closed worktree and a failed Reopen raises a notice with Retry', async () => {
    render(
      <ToastProvider>
        <MountsScene variant="closed-rows" />
      </ToastProvider>,
    );
    await advance();
    const attempts: Array<string> = [];
    useAppStore.setState({
      attachMount: async ({ mountId }) => {
        attempts.push(mountId);
        throw new Error('fatal: the worktree path is already registered by another process');
      },
    });

    fireEvent.click(
      present({
        value: notices().getAllByRole('button', { name: /^Reopen for/ })[0],
        what: 'Reopen',
      }),
    );
    await advance();

    const alert = notices().getByRole('alert');
    expect(alert.textContent).toMatch(/^Couldn't reopen /);
    fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
    await advance();
    expect(attempts).toHaveLength(2);
  });

  it('keeps the first lap Publish on the Overview', async () => {
    await mountScene({ name: 'frame-first-lap-notice' });

    expect(screen.getAllByRole('button', { name: 'Publish' }).length).toBeGreaterThan(0);
  });

  it('keeps the unassigned notes on the Overview', async () => {
    render(
      <ToastProvider>
        <MountsScene variant="unassigned-notes" />
      </ToastProvider>,
    );
    await advance();

    screen.getByRole('region', { name: 'Unassigned notes' });
  });

  it('keeps Needs you rows that open the exact ask', async () => {
    await mountScene({ name: 'c05-overview-running' });

    const needsYou = screen.getByRole('region', { name: 'Needs you' });
    expect(within(needsYou).getAllByRole('button', { name: /^Open: / }).length).toBeGreaterThan(0);
  });

  it('keeps the Log with its search and the session spend in the Activity header', async () => {
    await mountScene({ name: 'c05-overview-running' });
    const activity = within(screen.getByRole('region', { name: 'Activity' }));

    activity.getByRole('button', { name: /^Spend / });
    fireEvent.click(activity.getByRole('tab', { name: 'Log' }));
    await advance();

    activity.getByRole('searchbox', { name: 'Search the log' });
  });

  it('keeps an archived session read only with Restore', async () => {
    await mountScene({ name: 'c05-overview-archived' });

    header().getByRole('button', { name: /Restore/ });
    expect(header().getByRole('button', { name: 'New' }).closest('fieldset')?.disabled).toBe(true);
  });

  it('keeps the move of a task onto a branch by drag, now onto a worktree row of the sidebar', async () => {
    await mountScene({ name: 'taskdrag-overbranch' });

    const aimed = document.querySelector('[data-scene-aim]');
    expect(aimed?.getAttribute('data-task-drop')).toBe('branch');
    expect(aimed?.closest('[data-level-layer="session"]')).not.toBeNull();
  });
});
