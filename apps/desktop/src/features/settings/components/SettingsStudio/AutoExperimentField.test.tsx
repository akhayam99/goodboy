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
import { seedAutoSession, seedAutoTree } from '@goodboy/db/test-helpers/auto-seeds';
import { useAppStore } from '../../../../store';
import { SETTING_AUTO_EXPERIMENT } from '../../settings';
import { AutoExperimentField } from './AutoExperimentField';
import { ExperimentsBand } from './ExperimentsBand';

let db: Database;
const reportError = vi.fn(async () => undefined);

beforeEach(async () => {
  db = await makeMigratedTestDatabase();
  holder.db = db;
  reportError.mockClear();
  useAppStore.setState({ settings: {}, reportError });
});

afterEach(cleanup);

const stateOfSwitch = (): string | null =>
  screen.getByRole('switch', { name: 'Auto agent' }).getAttribute('aria-checked');

describe('the Experiments band', () => {
  it('draws the band, the experimental chip, the help once and an off switch', async () => {
    render(<ExperimentsBand />);

    expect(screen.getByRole('heading', { name: 'Experiments' })).toBeDefined();
    expect(screen.getByText('Early features that are still being tried out.')).toBeDefined();
    expect(screen.getByText('Experimental')).toBeDefined();
    expect(
      screen.getByText(
        'Start agents as Auto. It answers, or hands work to the roles it picks. It may not work well yet. Off keeps the roles you pick today.',
      ),
    ).toBeDefined();
    await waitFor(() => expect(stateOfSwitch()).toBe('false'));
    expect(screen.queryByText(/still running/)).toBeNull();
  });

  it('says how many Auto agents keep going when the switch is off', () => {
    render(<AutoExperimentField runningCount={2} />);

    expect(screen.getByText('2 Auto agents are still running. They keep going.')).toBeDefined();
  });

  it('says it in the singular for one', () => {
    render(<AutoExperimentField runningCount={1} />);

    expect(screen.getByText('1 Auto agent is still running. It keeps going.')).toBeDefined();
  });
});

describe('the running Auto agents line', () => {
  it('counts the trees that work in the database, and goes away once the switch is on', async () => {
    await seedAutoSession({ db });
    await seedAutoTree({ db });
    await db.execute("UPDATE auto_trees SET phase = 'waiting'");
    render(<ExperimentsBand />);

    expect(await screen.findByText('1 Auto agent is still running. It keeps going.')).toBeDefined();
    fireEvent.click(screen.getByRole('switch', { name: 'Auto agent' }));

    await waitFor(() => expect(stateOfSwitch()).toBe('true'));
    expect(screen.queryByText(/still running/)).toBeNull();
  });
});

describe('the Auto agent switch', () => {
  it('saves on, repaints from the stored value and saves off again', async () => {
    render(<AutoExperimentField />);

    fireEvent.click(screen.getByRole('switch', { name: 'Auto agent' }));
    await waitFor(() => expect(stateOfSwitch()).toBe('true'));
    expect(await getSetting(db, SETTING_AUTO_EXPERIMENT)).toBe('true');

    fireEvent.click(screen.getByRole('switch', { name: 'Auto agent' }));
    await waitFor(() => expect(stateOfSwitch()).toBe('false'));
    expect(await getSetting(db, SETTING_AUTO_EXPERIMENT)).toBe('false');
    expect(reportError).not.toHaveBeenCalled();
  });

  it('snaps back and names the failure when the write rejects', async () => {
    render(<AutoExperimentField />);
    await waitFor(() => expect(stateOfSwitch()).toBe('false'));
    holder.db = {
      ...db,
      execute: async (sql: string, params?: ReadonlyArray<unknown>) => {
        if (sql.startsWith('INSERT INTO settings') || sql.startsWith('UPDATE settings')) {
          throw new Error('disk is full');
        }
        return db.execute(sql, params);
      },
    };

    fireEvent.click(screen.getByRole('switch', { name: 'Auto agent' }));

    await waitFor(() => expect(reportError).toHaveBeenCalledTimes(1));
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Couldn't save the Auto setting" }),
    );
    expect(stateOfSwitch()).toBe('false');
    expect(await getSetting(db, SETTING_AUTO_EXPERIMENT)).toBeNull();
  });

  it('shows the stored value, not the click, when the answer was lost after the commit', async () => {
    render(<AutoExperimentField />);
    holder.db = {
      ...db,
      execute: async (sql: string, params?: ReadonlyArray<unknown>) => {
        const result = await db.execute(sql, params);
        if (sql.startsWith('INSERT INTO settings')) {
          throw new Error('the answer was lost');
        }
        return result;
      },
    };

    fireEvent.click(screen.getByRole('switch', { name: 'Auto agent' }));

    await waitFor(() => expect(stateOfSwitch()).toBe('true'));
    expect(reportError).not.toHaveBeenCalled();
  });

  it('writes once for two quick clicks', async () => {
    render(<AutoExperimentField />);
    const writes: string[] = [];
    holder.db = {
      ...db,
      execute: async (sql: string, params?: ReadonlyArray<unknown>) => {
        if (sql.startsWith('INSERT INTO settings') || sql.startsWith('UPDATE settings')) {
          writes.push(sql);
        }
        return db.execute(sql, params);
      },
    };
    const toggle = screen.getByRole('switch', { name: 'Auto agent' });

    await act(async () => {
      fireEvent.click(toggle);
      fireEvent.click(toggle);
    });

    await waitFor(() => expect(stateOfSwitch()).toBe('true'));
    expect(writes).toHaveLength(1);
  });

  it('follows another window that turned it on once the page reloads the value', async () => {
    render(<AutoExperimentField />);
    await waitFor(() => expect(stateOfSwitch()).toBe('false'));

    await setSetting(db, SETTING_AUTO_EXPERIMENT, 'true');
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => expect(stateOfSwitch()).toBe('true'));
  });
});
