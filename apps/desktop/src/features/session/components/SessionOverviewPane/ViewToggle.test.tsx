// @vitest-environment happy-dom

const holder = vi.hoisted(() => {
  const state: { db: unknown } = { db: null };
  return state;
});

vi.mock('../../../../shared/lib/db', () => ({
  get tauriDatabase() {
    return holder.db;
  },
}));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { getSetting, setSetting, type Database } from '@goodboy/db';
import { makeMigratedTestDatabase } from '@goodboy/db/test-helpers';
import { brandId, type IsoDateTime } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import { ToastProvider } from '../../../../shared/components/Toast';
import { useAppStore } from '../../../../store';
import { SETTING_OVERVIEW_LAYOUT } from '../../../settings/settings';
import { OverviewHeaderActions } from './OverviewHeaderActions';

let db: Database;
const reportError = vi.fn(async () => undefined);

const SESSION = aSession({ goal: 'Ship the ledger sync' });

const ARCHIVED = aSession({
  id: brandId<typeof SESSION.id>({ value: 'session-archived' }),
  goal: 'Old ledger sync',
  archivedAt: brandId<IsoDateTime>({ value: '2026-10-01T10:00:00.000Z' }),
});

beforeEach(async () => {
  db = await makeMigratedTestDatabase();
  holder.db = db;
  reportError.mockClear();
  useAppStore.setState({
    settings: {},
    reportError,
    sessions: [SESSION, ARCHIVED],
    currentSessionId: SESSION.id,
    undoStack: [],
    undoNotices: [],
  });
});

afterEach(cleanup);

const heightClassOf = (element: HTMLElement): ReadonlyArray<string> =>
  element.className.split(' ').filter((name) => /^h-\d+$/.test(name));

const tabOf = (name: string): HTMLElement => screen.getByRole('tab', { name });

const isSelected = (name: string): boolean => tabOf(name).getAttribute('aria-selected') === 'true';

describe('the view toggle', () => {
  it.each([null, 'classic', 'new'])(
    'shows left of New at the same height while the setting is %s',
    async (stored) => {
      if (stored !== null) {
        await setSetting(db, SETTING_OVERVIEW_LAYOUT, stored);
      }
      render(<OverviewHeaderActions session={SESSION} />);

      const toggle = await screen.findByRole('tablist', { name: 'Overview' });
      const create = screen.getByRole('button', { name: 'New' });

      expect(
        toggle.compareDocumentPosition(create) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(heightClassOf(toggle)).toEqual(heightClassOf(create));
    },
  );

  it('stays left of Restore on an archived session on Classic', async () => {
    render(
      <ToastProvider>
        <OverviewHeaderActions session={ARCHIVED} />
      </ToastProvider>,
    );

    const toggle = await screen.findByRole('tablist', { name: 'Overview' });
    const restore = screen.getByRole('button', { name: /Restore/ });

    expect(screen.queryByRole('button', { name: 'New' })).toBeNull();
    expect(toggle.compareDocumentPosition(restore) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(heightClassOf(toggle)).toEqual(heightClassOf(restore));
  });

  it('offers exactly Classic and New', async () => {
    render(<OverviewHeaderActions session={SESSION} />);

    await screen.findByRole('tablist', { name: 'Overview' });

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Classic', 'New']);
  });

  it('selects Classic while nothing is stored', async () => {
    render(<OverviewHeaderActions session={SESSION} />);

    await screen.findByRole('tablist', { name: 'Overview' });

    expect(isSelected('Classic')).toBe(true);
    expect(isSelected('New')).toBe(false);
  });

  it('selects New while the setting is new', async () => {
    await setSetting(db, SETTING_OVERVIEW_LAYOUT, 'new');
    render(<OverviewHeaderActions session={SESSION} />);

    await waitFor(() => expect(isSelected('New')).toBe(true));
    expect(isSelected('Classic')).toBe(false);
  });
});

describe('picking New', () => {
  it('writes the setting new with no toast, and the selection moves', async () => {
    render(<OverviewHeaderActions session={SESSION} />);
    await screen.findByRole('tablist', { name: 'Overview' });

    fireEvent.click(tabOf('New'));

    await waitFor(async () => expect(await getSetting(db, SETTING_OVERVIEW_LAYOUT)).toBe('new'));
    expect(useAppStore.getState().undoNotices).toEqual([]);
    await waitFor(() => expect(isSelected('New')).toBe(true));
  });

  it('keeps Classic and shows the error when the save fails', async () => {
    render(<OverviewHeaderActions session={SESSION} />);
    await screen.findByRole('tablist', { name: 'Overview' });
    holder.db = {
      ...db,
      execute: async (sql: string, params?: ReadonlyArray<unknown>) => {
        if (sql.startsWith('INSERT') && sql.includes('settings')) {
          throw new Error('disk is full');
        }
        return db.execute(sql, params);
      },
    };

    fireEvent.click(tabOf('New'));

    await waitFor(() => expect(reportError).toHaveBeenCalled());
    expect(await getSetting(db, SETTING_OVERVIEW_LAYOUT)).toBeNull();
    expect(isSelected('Classic')).toBe(true);
    expect(useAppStore.getState().undoNotices).toEqual([]);
  });
});

describe('picking Classic', () => {
  it('writes the setting classic, the toggle stays and a toast offers Undo', async () => {
    await setSetting(db, SETTING_OVERVIEW_LAYOUT, 'new');
    render(<OverviewHeaderActions session={SESSION} />);
    await waitFor(() => expect(isSelected('New')).toBe(true));

    fireEvent.click(tabOf('Classic'));

    await waitFor(async () =>
      expect(await getSetting(db, SETTING_OVERVIEW_LAYOUT)).toBe('classic'),
    );
    expect(screen.getByRole('tablist', { name: 'Overview' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'New' })).toBeDefined();
    expect(useAppStore.getState().undoNotices.map((notice) => notice.toast)).toMatchObject([
      { message: 'Back on the classic overview.', action: { label: 'Undo' } },
    ]);
  });

  it('brings the new overview back when the toast Undo is used', async () => {
    await setSetting(db, SETTING_OVERVIEW_LAYOUT, 'new');
    render(<OverviewHeaderActions session={SESSION} />);
    await waitFor(() => expect(isSelected('New')).toBe(true));
    fireEvent.click(tabOf('Classic'));
    await waitFor(() =>
      expect(useAppStore.getState().settings[SETTING_OVERVIEW_LAYOUT]).toBe('classic'),
    );

    await act(async () => {
      await useAppStore.getState().undoLastOperation();
    });

    expect(await getSetting(db, SETTING_OVERVIEW_LAYOUT)).toBe('new');
    expect(useAppStore.getState().settings[SETTING_OVERVIEW_LAYOUT]).toBe('new');
    await waitFor(() => expect(isSelected('New')).toBe(true));
  });

  it('says nothing and writes nothing when Classic is already the overview', async () => {
    render(<OverviewHeaderActions session={SESSION} />);
    await screen.findByRole('tablist', { name: 'Overview' });

    fireEvent.click(tabOf('Classic'));

    await act(async () => {
      await Promise.resolve();
    });
    expect(await getSetting(db, SETTING_OVERVIEW_LAYOUT)).toBeNull();
    expect(useAppStore.getState().undoNotices).toEqual([]);
  });

  it('keeps the new overview and shows the error when the save fails', async () => {
    await setSetting(db, SETTING_OVERVIEW_LAYOUT, 'new');
    render(<OverviewHeaderActions session={SESSION} />);
    await waitFor(() => expect(isSelected('New')).toBe(true));
    holder.db = {
      ...db,
      execute: async (sql: string, params?: ReadonlyArray<unknown>) => {
        if (sql.startsWith('UPDATE settings')) {
          throw new Error('disk is full');
        }
        return db.execute(sql, params);
      },
    };

    fireEvent.click(tabOf('Classic'));

    await waitFor(() => expect(reportError).toHaveBeenCalled());
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Couldn't save the overview setting" }),
    );
    expect(await getSetting(db, SETTING_OVERVIEW_LAYOUT)).toBe('new');
    expect(isSelected('New')).toBe(true);
    expect(useAppStore.getState().undoNotices).toEqual([]);
  });
});
