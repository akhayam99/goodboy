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

const sessionList = (): HTMLElement => screen.getByRole('listbox', { name: 'Sessions' });

const titleOf = (row: Element): string => {
  const text = row.textContent ?? '';
  const project = ['ledger-core', 'notify-relay', 'payments-api'].find((name) =>
    text.endsWith(name),
  );
  return project === undefined ? text : text.slice(0, text.length - project.length);
};

const groupOf = (name: string): HTMLElement => {
  const group = within(sessionList())
    .getAllByRole('group')
    .find((candidate) => candidate.firstElementChild?.textContent?.startsWith(name) === true);
  if (group === undefined) {
    throw new Error(`Sessions has no group ${name}`);
  }
  return group;
};

const rowTitles = (root: HTMLElement): ReadonlyArray<string> =>
  within(root)
    .getAllByRole('option')
    .map((row) => titleOf(row));

const rowOf = (title: string): HTMLElement => {
  const row = within(sessionList())
    .getAllByRole('option')
    .find((candidate) => titleOf(candidate) === title);
  if (row === undefined) {
    throw new Error(`Sessions has no row ${title}`);
  }
  return row;
};

const togglePin = (title: string): void => {
  const pin = rowOf(title).querySelector<HTMLElement>('[data-sessions-pin]');
  if (pin === null) {
    throw new Error(`the row ${title} has no pin`);
  }
  fireEvent.click(pin);
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
    fireEvent.click(await screen.findByRole('button', { name: 'Sessions' }));
    await waitFor(() => expect(groupOf('Pinned')).toBeDefined());
  };

  it('opens the session on its Overview, not on the loading skeleton', async () => {
    await mount();

    expect((await screen.findByTestId('overview-title')).closest('h1')).not.toBeNull();
    expect(screen.queryByRole('status', { name: 'Loading session overview' })).toBeNull();
  });

  it('puts the Pinned group first in Sessions, with the two pins in pin order', async () => {
    await mount();

    expect(within(sessionList()).getAllByRole('group')[0]).toBe(groupOf('Pinned'));
    expect(rowTitles(groupOf('Pinned'))).toEqual([
      'Reconcile the ledger export',
      'Paginate the payments list',
    ]);
  });

  it('shows each pinned session once', async () => {
    await mount();

    const all = rowTitles(sessionList());
    expect(all.filter((title) => title === 'Reconcile the ledger export')).toHaveLength(1);
    expect(all.filter((title) => title === 'Paginate the payments list')).toHaveLength(1);
  });

  it('pins a session from its row, moves it into Pinned in pin order, and unpins it again', async () => {
    await mount();

    togglePin('Backfill the settlement dates');

    await waitFor(() =>
      expect(rowTitles(groupOf('Pinned'))).toEqual([
        'Reconcile the ledger export',
        'Paginate the payments list',
        'Backfill the settlement dates',
      ]),
    );
    expect(screen.queryByText("Couldn't pin the session")).toBeNull();

    togglePin('Backfill the settlement dates');

    await waitFor(() =>
      expect(rowTitles(groupOf('Pinned'))).toEqual([
        'Reconcile the ledger export',
        'Paginate the payments list',
      ]),
    );
  });

  it('keeps the seeded pins after a pin is written, because the database holds them too', async () => {
    await mount();

    togglePin('Tune the payments rate limiter');

    await waitFor(() => expect(rowTitles(groupOf('Pinned'))).toHaveLength(3));
    expect(rowTitles(groupOf('Pinned')).slice(0, 2)).toEqual([
      'Reconcile the ledger export',
      'Paginate the payments list',
    ]);
  });
});
