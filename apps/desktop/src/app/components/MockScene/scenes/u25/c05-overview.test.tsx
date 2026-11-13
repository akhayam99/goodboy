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

const nextRows = (): ReadonlyArray<HTMLElement> => {
  const next = present({
    value: document.querySelector<HTMLElement>('[data-overview-card="branches"]'),
    what: 'Branches card',
  });
  for (const fold of next.querySelectorAll<HTMLElement>('button[aria-expanded="false"]')) {
    fireEvent.click(fold);
  }
  return Array.from(next.querySelectorAll<HTMLElement>('[data-action-card]'));
};

const cardOrder = (): ReadonlyArray<string> =>
  Array.from(document.querySelectorAll('[data-overview-card]')).map(
    (card) => card.getAttribute('data-overview-card') ?? '',
  );

describe('the c05 overview scenes', () => {
  it('registers every scene for the capture', () => {
    Object.entries(U25_C05_OVERVIEW_SCENES).forEach(([name, Scene]) =>
      expect(MOCK_SCENES[name]).toBe(Scene),
    );
  });

  it('c05-overview-running puts Needs you first when it has rows, rows without an Open word', async () => {
    await mount('c05-overview-running');

    const order = cardOrder();
    expect(order.length).toBeGreaterThan(0);
    expect(order.indexOf('needs-you')).toBeLessThanOrEqual(0);
    expect(screen.queryByRole('region', { name: 'Activity' })).toBeNull();
    const first = document.querySelector<HTMLElement>('[data-overview-card]');
    const rows = within(present({ value: first, what: 'the first card' })).getAllByRole('button');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.map((row) => row.textContent)).not.toContain('Open');
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
    expect(screen.queryByPlaceholderText('What should it do?')).toBeNull();
    const needsYou = screen.getByRole('region', { name: 'Needs you' });
    expect(needsYou.contains(notices)).toBe(false);
    expect(
      document.querySelector('[data-overview-glance]')?.getAttribute('data-overview-glance'),
    ).toBe('waiting');
    const count = Number(needsYou.querySelector('[data-overview-count]')?.textContent);
    expect(count).toBeGreaterThan(needsYou.querySelectorAll('[data-action-card]').length);
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
