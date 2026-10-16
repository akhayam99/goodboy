// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import { U25_C07_AUTO_SCENES } from './c07-auto';

const WAIT = { timeout: 15_000 };

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

type MountParams = {
  readonly id: keyof typeof U25_C07_AUTO_SCENES;
};

const mount = ({ id }: MountParams): void => {
  const Scene = U25_C07_AUTO_SCENES[id];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const levelStack = (): HTMLElement => {
  const stack = document.querySelector<HTMLElement>('[data-level-stack]');
  if (stack === null) {
    throw new Error('no level stack');
  }
  return stack;
};

const shownLayer = (): HTMLElement => {
  const layer = document.querySelector<HTMLElement>(
    `[data-level-layer="${levelStack().dataset.levelStack ?? ''}"]`,
  );
  if (layer === null) {
    throw new Error('no shown layer');
  }
  return layer;
};

describe('c07 Auto scenes', () => {
  it('registers every scene for the capture', () => {
    for (const [id, Scene] of Object.entries(U25_C07_AUTO_SCENES)) {
      expect(MOCK_SCENES[id]).toBe(Scene);
    }
  });

  it('c07-auto-working drills the sidebar into Auto: back row, work rail, limit foot', async () => {
    mount({ id: 'c07-auto-working' });

    await waitFor(() => expect(levelStack().dataset.levelStack).toBe('auto'), WAIT);
    const level = shownLayer();
    expect(within(level).getByRole('button', { name: /^Back to / })).toBeDefined();
    const rail = within(level).getByRole('list', { name: 'Work' });
    expect(within(rail).getAllByRole('listitem')).toHaveLength(4);
    const foot = within(level).getByRole('region', { name: 'Limit' });
    expect(within(foot).getByRole('button', { name: 'Limit $10.00' })).toBeDefined();
    expect(within(foot).getByText('$5.23 left')).toBeDefined();
  });

  it('goes back to the session level with Auto agents selected, and drills in again', async () => {
    mount({ id: 'c07-auto-working' });

    await waitFor(() => expect(levelStack().dataset.levelStack).toBe('auto'), WAIT);
    fireEvent.click(within(shownLayer()).getByRole('button', { name: /^Back to / }));

    await waitFor(() => expect(levelStack().dataset.levelStack).toBe('session'), WAIT);
    const entry = within(shownLayer()).getByRole('button', { name: /Auto agents/ });
    expect(entry.getAttribute('aria-current')).toBe('page');
    expect(within(entry).getByText('Experimental')).toBeDefined();

    fireEvent.click(entry);
    await waitFor(() => expect(levelStack().dataset.levelStack).toBe('auto'), WAIT);
  });

  it('c07-auto-folded shows the Auto level as rings with the back icon first', async () => {
    mount({ id: 'c07-auto-folded' });

    const rail = await waitFor(() => {
      const found = document.querySelector<HTMLElement>('[data-column-rail]');
      expect(found?.dataset.sidebarLevel).toBe('auto');
      return found;
    }, WAIT);
    if (rail === null || rail === undefined) {
      throw new Error('no folded rail');
    }
    expect(within(rail).getByRole('button', { name: /^Back to / })).toBeDefined();
    expect(within(rail).getByRole('button', { name: 'Implementer, Running' })).toBeDefined();
    expect(within(rail).getByRole('button', { name: 'Tester, Queued' })).toBeDefined();
  });

  it('c07-auto-session-level keeps the Auto chat in the center with the session level shown', async () => {
    mount({ id: 'c07-auto-session-level' });

    await waitFor(() => expect(levelStack().dataset.levelStack).toBe('session'), WAIT);
    expect(screen.getByText('Waiting for Implementer and Tester')).toBeDefined();
  });

  it('c07-auto-idle reads Idle on the Auto row of the rail', async () => {
    mount({ id: 'c07-auto-idle' });

    await waitFor(() => expect(levelStack().dataset.levelStack).toBe('auto'), WAIT);
    const rail = within(shownLayer()).getByRole('list', { name: 'Work' });
    expect(within(rail).getByText('Idle')).toBeDefined();
    expect(within(rail).getAllByRole('listitem')).toHaveLength(5);
  });

  it('c07-auto-answering shows Auto alone on the rail with the empty state', async () => {
    mount({ id: 'c07-auto-answering' });

    await waitFor(() => expect(levelStack().dataset.levelStack).toBe('auto'), WAIT);
    const level = shownLayer();
    expect(within(level).getAllByRole('listitem')).toHaveLength(1);
    expect(within(level).getByText('No agents started yet')).toBeDefined();
  });

  it('c07-auto-list lists every Auto conversation on one grid and opens one', async () => {
    mount({ id: 'c07-auto-list' });

    const list = await screen.findByRole('list', { name: 'Auto agents' }, WAIT);
    const rows = within(list).getAllByRole('button');
    expect(rows).toHaveLength(2);
    expect(within(list).getByText('Idle')).toBeDefined();
    expect(within(list).getByText('Finished')).toBeDefined();
    expect(levelStack().dataset.levelStack).toBe('session');

    fireEvent.click(rows[0] ?? list);
    await waitFor(() => expect(levelStack().dataset.levelStack).toBe('auto'), WAIT);
  });

  it('c07-auto-start offers Start Auto with a goal field when the session has none', async () => {
    mount({ id: 'c07-auto-start' });

    const start = await screen.findByRole('region', { name: 'Start Auto' }, WAIT);
    expect(
      within(start).getByText(
        'Ask Auto a question or give it a task. It answers itself, or starts the right agent.',
      ),
    ).toBeDefined();
    expect(within(start).getByRole('button', { name: /Start Auto/ })).toBeDefined();
  });
});
