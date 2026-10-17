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
import { resetWorktreeStatusCache } from '../../../../../store/slices/worktreeStatuses/cache';
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

const body = (): HTMLElement => {
  const pane = document.querySelector<HTMLElement>('[data-slot="pane-body"]');
  if (pane === null) {
    throw new Error('no Overview pane body');
  }
  return pane;
};

const sectionOrder = (): ReadonlyArray<string> =>
  Array.from(body().querySelectorAll(':scope > section'))
    .map((section) => section.getAttribute('aria-label') ?? '')
    .filter((label) => label !== '');

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

const nextRows = (): ReadonlyArray<HTMLElement> =>
  Array.from(
    screen
      .getByRole('region', { name: 'Next steps' })
      .querySelectorAll<HTMLElement>('[data-testid^="next-step-"]'),
  );

describe('the c05 overview scenes', () => {
  it('registers every scene for the capture', () => {
    Object.entries(U25_C05_OVERVIEW_SCENES).forEach(([name, Scene]) =>
      expect(MOCK_SCENES[name]).toBe(Scene),
    );
  });

  it('c05-overview-running puts Needs you above Next and Activity, rows without an Open word', async () => {
    await mount('c05-overview-running');

    const order = sectionOrder();
    const needsYouAt = order.indexOf('Needs you');
    const activityAt = order.indexOf('Activity');
    expect(needsYouAt).toBeGreaterThanOrEqual(0);
    expect(activityAt).toBeGreaterThan(needsYouAt);
    expect(order.indexOf('Next') === -1 || order.indexOf('Next') > needsYouAt).toBe(true);
    const needsYou = screen.getByRole('region', { name: 'Needs you' });
    const rows = within(needsYou).getAllByRole('button');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.map((row) => row.textContent)).not.toContain('Open');
    expect(screen.queryByRole('region', { name: 'Projects' })).toBeNull();
  });

  it('c05-overview-lanes draws every Activity row on one gutter with the step number in its slot', async () => {
    await mount('c05-overview-lanes');

    const activity = screen.getByRole('region', { name: 'Activity' });
    const widths = new Set(
      Array.from(activity.querySelectorAll('[data-row-id]')).map((row) => {
        const rail = row.children[1];
        return rail instanceof HTMLElement ? rail.style.width : '';
      }),
    );
    expect(widths.size).toBe(1);
    expect(activity.querySelectorAll('[data-timeline-ordinal]').length).toBeGreaterThan(0);
  });

  it('c05-overview-merged-next offers Remove the worktree with the merge and the size', async () => {
    await mount('c05-overview-merged-next');

    const row = nextRows().find((candidate) =>
      (candidate.textContent ?? '').includes('Remove the ledger-core worktree'),
    );
    expect(row).toBeDefined();
    expect(row?.textContent).toContain('#418 merged · 412 MB');
    const remove = within(present({ value: row, what: 'the cleanup row' })).getByRole('button', {
      name: 'Remove worktree',
    });
    expect(remove.textContent).toBe('Remove');
    within(present({ value: row, what: 'the cleanup row' })).getByRole('button', {
      name: 'Not now',
    });
    expect(screen.queryByRole('button', { name: 'Keep' })).toBeNull();
  });

  it('c05-overview-merged-group folds two merged worktrees into one row', async () => {
    await mount('c05-overview-merged-group');

    const rows = nextRows().filter((candidate) =>
      (candidate.textContent ?? '').includes('Remove 2 merged worktrees'),
    );
    expect(rows).toHaveLength(1);
    within(present({ value: rows[0], what: 'the grouped row' })).getByRole('button', {
      name: 'Remove worktrees',
    });
  });

  it('c05-overview-notices shows the closed worktree and the branch decision in the notices slot', async () => {
    await mount('c05-overview-notices');

    const notices = screen.getByRole('region', { name: 'Notices' });
    within(notices).getByRole('button', { name: /^Restore branch for/ });
    within(notices).getByRole('button', { name: 'Use this branch here' });
    expect(sectionOrder()[0]).toBe('Notices');
  });

  it('c05-overview-blank offers Add a goal and fills one primary only', async () => {
    await mount('c05-overview-blank');

    screen.getByRole('button', { name: 'Add a goal' });
    const hasNext = screen.queryByRole('region', { name: 'Next steps' }) !== null;
    expect(screen.getByRole('button', { name: 'New' }).getAttribute('data-variant')).toBe(
      hasNext ? 'secondary' : 'primary',
    );
    expect(
      document.querySelectorAll('[data-slot="pane-body"] [data-variant="primary"]').length +
        (hasNext ? 0 : 1),
    ).toBe(1);
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
