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
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { setSetting, type Database } from '@goodboy/db';
import { makeMigratedTestDatabase } from '@goodboy/db/test-helpers';
import { useAppStore } from '../../../../store';
import { SETTING_OVERVIEW_LAYOUT } from '../../../settings/settings';
import { overviewLayoutOf } from '../overviewLayoutOf';
import { useOverviewLayout } from '.';

let db: Database;

const Probe = () => <p>{`layout ${useOverviewLayout()}`}</p>;

beforeEach(async () => {
  db = await makeMigratedTestDatabase();
  holder.db = db;
  useAppStore.setState({ settings: {} });
});

afterEach(cleanup);

describe('overviewLayoutOf', () => {
  it.each([null, undefined, '', 'classic', 'true', 'NEW', 'other'])('is classic for %s', (raw) => {
    expect(overviewLayoutOf({ raw })).toBe('classic');
  });

  it('is new only for the exact string new', () => {
    expect(overviewLayoutOf({ raw: 'new' })).toBe('new');
  });
});

describe('useOverviewLayout', () => {
  it('is classic with no stored row, as after an upgrade', async () => {
    render(<Probe />);

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(screen.getByText('layout classic')).toBeDefined();
  });

  it('loads the stored value when it mounts', async () => {
    await setSetting(db, SETTING_OVERVIEW_LAYOUT, 'new');

    render(<Probe />);

    await waitFor(() => expect(screen.getByText('layout new')).toBeDefined());
  });

  it('keeps a window on classic until it gets focus, then swaps', async () => {
    render(<Probe />);
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });
    await setSetting(db, SETTING_OVERVIEW_LAYOUT, 'new');

    expect(screen.getByText('layout classic')).toBeDefined();
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => expect(screen.getByText('layout new')).toBeDefined());
  });

  it('goes back to classic on the next focus when another window turned it off', async () => {
    await setSetting(db, SETTING_OVERVIEW_LAYOUT, 'new');
    render(<Probe />);
    await waitFor(() => expect(screen.getByText('layout new')).toBeDefined());

    await setSetting(db, SETTING_OVERVIEW_LAYOUT, 'classic');
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => expect(screen.getByText('layout classic')).toBeDefined());
  });
});
