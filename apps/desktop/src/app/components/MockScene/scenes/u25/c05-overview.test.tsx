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
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { resetWorktreeStatusCache } from '../../../../../store/runtime/worktreeStatuses/cache';
import { MOCK_SCENES } from '../..';
import { U25_C05_OVERVIEW_SCENES } from './c05-overview';

const SETTLE_MS = 2_000;

type SceneName = keyof typeof U25_C05_OVERVIEW_SCENES;

beforeAll(async () => {
  await importStore();
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

const mount = async (name: SceneName): Promise<void> => {
  const Scene = U25_C05_OVERVIEW_SCENES[name];
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

describe('the c05 overview scenes', () => {
  it('registers every scene for the capture', () => {
    Object.entries(U25_C05_OVERVIEW_SCENES).forEach(([name, Scene]) =>
      expect(MOCK_SCENES[name]).toBe(Scene),
    );
  });

  it('c05-overview-running draws the tiles above one row per branch, with no Open word', async () => {
    await mount('c05-overview-running');

    const board = screen.getByRole('region', { name: 'Branches' });
    expect(document.querySelector('[data-slot="session-kpis"]')?.children).toHaveLength(5);
    expect(board.querySelectorAll('[data-board-row]').length).toBeGreaterThan(0);
    expect(within(board).queryByRole('button', { name: 'Open' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Activity' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Projects' })).toBeNull();
  });

  it('c05-overview-running-loading keeps the Browser count on its skeleton', async () => {
    await mount('c05-overview-running-loading');

    expect(screen.getByTestId('tool-count-skeleton').getAttribute('aria-label')).toBe('Loading');
  });

  it('c05-overview-lanes draws every log row on one gutter with the step number in its slot', async () => {
    await mount('c05-overview-lanes');

    const activity = screen.getByRole('region', { name: 'Log entries' });
    const widths = new Set(
      Array.from(activity.querySelectorAll('[data-row-id]')).map((row) => {
        const rail = row.children[1];
        return rail instanceof HTMLElement ? rail.style.width : '';
      }),
    );
    expect(widths.size).toBe(1);
    expect(activity.querySelectorAll('[data-timeline-ordinal]').length).toBeGreaterThan(0);
  });

  it('c05-overview-merged-next keeps the merged branch as a row and offers its worktree with the size', async () => {
    await mount('c05-overview-merged-next');

    const merged = present({
      value: document.querySelector<HTMLElement>('[data-board-group="merged"]'),
      what: 'Merged group',
    });
    expect(merged.textContent).toContain('#412');
    const remove = within(merged).getByRole('button', { name: /^Remove 1 worktree/ });
    expect(remove.textContent).toContain('412 MB');
    expect(screen.queryByRole('button', { name: 'Keep' })).toBeNull();
  });

  it('c05-overview-merged-group lists both merged branches and one button for their worktrees', async () => {
    await mount('c05-overview-merged-group');

    const merged = present({
      value: document.querySelector<HTMLElement>('[data-board-group="merged"]'),
      what: 'Merged group',
    });
    expect(merged.querySelectorAll('[data-board-row]').length).toBeGreaterThanOrEqual(2);
    expect(within(merged).getAllByRole('button', { name: /^Remove 2 worktrees/ })).toHaveLength(1);
  });

  it('c05-overview-notices shows the closed worktree and the branch decision in the notices slot', async () => {
    await mount('c05-overview-notices');

    const notices = screen.getByRole('region', { name: 'Notices' });
    within(notices).getByRole('button', { name: /^Restore branch for/ });
    within(notices).getByRole('button', { name: 'Use this branch here' });
    expect(screen.queryByPlaceholderText('What should it do?')).toBeNull();
    expect(screen.getByRole('region', { name: 'Branches' }).contains(notices)).toBe(false);
  });

  it('c05-overview-blank starts inline, with New as the outline button and Start as the primary', async () => {
    await mount('c05-overview-blank');

    screen.getByRole('button', { name: 'Add a goal' });
    screen.getByRole('textbox', { name: 'Start a run' });
    expect(screen.getByRole('button', { name: 'New' }).getAttribute('data-variant')).toBe(
      'secondary',
    );
    expect(screen.getByRole('button', { name: 'Start' }).getAttribute('data-variant')).toBe(
      'primary',
    );
  });

  it('c05-overview-archived is read only with Restore in the header', async () => {
    await mount('c05-overview-archived');

    const header = document.querySelector<HTMLElement>('[data-slot="pane-header"]');
    expect(header).not.toBeNull();
    within(present({ value: header, what: 'the header' })).getByRole('button', { name: /Restore/ });
    expect(screen.queryByRole('button', { name: 'New' })).toBeNull();
    expect(screen.queryByText('Archived')).toBeNull();
  });
});
