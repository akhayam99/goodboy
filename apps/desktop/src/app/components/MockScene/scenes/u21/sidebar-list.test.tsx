// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { ObjectMenuProvider } from '../../../../../features/actions/components/ObjectMenuProvider';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { SessionCardScene } from './SessionCardScene';
import { SessionPinnedScene } from './SessionPinnedScene';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  clearSceneInvoke();
});

const sessionList = (): HTMLElement => {
  const list = document.querySelector('[data-column-sessions]');
  if (list === null) {
    throw new Error('the scene has no sessions list');
  }
  return list as HTMLElement;
};

const rowTitles = (root: HTMLElement): ReadonlyArray<string> =>
  Array.from(root.querySelectorAll('button[data-select-id]')).map(
    (row) => row.lastElementChild?.textContent ?? '',
  );

const groupOf = (name: RegExp): HTMLElement => {
  const header = screen.getByRole('button', { name });
  return header.parentElement as HTMLElement;
};

describe('the pinned sessions scene', () => {
  const mount = async () => {
    render(
      <ToastProvider>
        <ObjectMenuProvider>
          <SessionPinnedScene />
        </ObjectMenuProvider>
      </ToastProvider>,
    );
    await waitFor(() => expect(screen.getByRole('button', { name: /^Pinned/ })).toBeDefined());
  };

  it('opens the session on its Overview, not on the loading skeleton', async () => {
    await mount();

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Add idempotency keys to payments-api',
      }),
    ).toBeDefined();
    expect(screen.queryByRole('status', { name: 'Loading session overview' })).toBeNull();
  });

  it('puts the Pinned group first, with the two pins in pin order', async () => {
    await mount();

    const headers = Array.from(sessionList().querySelectorAll('button[aria-expanded]'))
      .map((button) => button.textContent)
      .filter((text) => text !== '');
    expect(headers).toEqual(['Pinned2', 'ledger-core2', 'notify-relay2', 'payments-api2']);
    expect(rowTitles(groupOf(/^Pinned/))).toEqual([
      'Reconcile the ledger export',
      'Paginate the payments list',
    ]);
  });

  it('shows each pinned session once and leaves it out of its project group and its count', async () => {
    await mount();

    const all = rowTitles(sessionList());
    expect(all.filter((title) => title === 'Reconcile the ledger export')).toHaveLength(1);
    expect(all.filter((title) => title === 'Paginate the payments list')).toHaveLength(1);
    expect(rowTitles(groupOf(/^ledger-core/))).toEqual([
      'Backfill the settlement dates',
      'Move the ledger export to a queue',
    ]);
    expect(within(groupOf(/^ledger-core/)).getByText('2')).toBeDefined();
    expect(within(groupOf(/^payments-api/)).getByText('2')).toBeDefined();
  });

  const rowOf = (title: string): HTMLElement => {
    const row = Array.from(sessionList().querySelectorAll('button[data-select-id]')).find(
      (candidate) => candidate.lastElementChild?.textContent === title,
    );
    if (!(row instanceof HTMLElement)) {
      throw new Error(`the list has no row ${title}`);
    }
    return row;
  };

  it('pins a session from its menu, moves it into Pinned in pin order, and unpins it again', async () => {
    await mount();

    fireEvent.contextMenu(rowOf('Backfill the settlement dates'));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Pin session' }));

    await waitFor(() =>
      expect(rowTitles(groupOf(/^Pinned/))).toEqual([
        'Reconcile the ledger export',
        'Paginate the payments list',
        'Backfill the settlement dates',
      ]),
    );
    expect(within(groupOf(/^Pinned/)).getByText('3')).toBeDefined();
    expect(rowTitles(groupOf(/^ledger-core/))).toEqual(['Move the ledger export to a queue']);
    expect(screen.queryByText("Couldn't pin the session")).toBeNull();

    fireEvent.contextMenu(rowOf('Backfill the settlement dates'));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Unpin session' }));

    await waitFor(() =>
      expect(rowTitles(groupOf(/^Pinned/))).toEqual([
        'Reconcile the ledger export',
        'Paginate the payments list',
      ]),
    );
    expect(rowTitles(groupOf(/^ledger-core/))).toEqual([
      'Backfill the settlement dates',
      'Move the ledger export to a queue',
    ]);
  });

  it('keeps the seeded pins after a pin is written, because the database holds them too', async () => {
    await mount();

    fireEvent.contextMenu(rowOf('Tune the payments rate limiter'));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Pin session' }));

    await waitFor(() => expect(within(groupOf(/^Pinned/)).getByText('3')).toBeDefined());
    expect(rowTitles(groupOf(/^Pinned/)).slice(0, 2)).toEqual([
      'Reconcile the ledger export',
      'Paginate the payments list',
    ]);
  });

  it('folds one project group away and keeps the open session in its card', async () => {
    await mount();

    expect(
      screen.getByRole('button', { name: /^notify-relay/ }).getAttribute('aria-expanded'),
    ).toBe('false');
    expect(rowTitles(groupOf(/^notify-relay/))).toEqual([]);
    const cards = sessionList().querySelectorAll('[data-session-card]');
    expect(cards).toHaveLength(1);
    expect(groupOf(/^payments-api/).contains(cards[0] ?? null)).toBe(true);
  });
});

describe('the session card scene', () => {
  it('wraps the open session and its five pages in one card and leaves the others flat', async () => {
    render(
      <ToastProvider>
        <SessionCardScene />
      </ToastProvider>,
    );
    await waitFor(() => expect(document.querySelector('[data-session-card]')).not.toBeNull());

    const cards = sessionList().querySelectorAll<HTMLElement>('[data-session-card]');
    expect(cards).toHaveLength(1);
    const card = within(cards[0] as HTMLElement);
    expect(card.getByRole('button', { name: /^Add POST \/orders[^,]*$/ })).toBeDefined();
    const pages = card
      .getAllByRole('button')
      .filter((button) => button.closest('ul[aria-label="Pages"]'));
    expect(pages.map((page) => page.textContent?.replace(/\d.*$/, '').trim())).toEqual([
      'Overview',
      'Branch',
      'Runs',
      'Agents',
      'Artifacts',
    ]);
    expect(pages.filter((page) => page.getAttribute('aria-current') === 'page')).toHaveLength(1);
    const flat = rowTitles(sessionList()).length - 1;
    expect(flat).toBeGreaterThan(0);
  });
});
