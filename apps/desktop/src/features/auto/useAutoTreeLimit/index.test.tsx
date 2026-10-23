// @vitest-environment happy-dom

const holder = vi.hoisted(() => {
  const state: { db: unknown } = { db: null };
  return state;
});

vi.mock('../../../shared/lib/db', () => ({
  get tauriDatabase() {
    return holder.db;
  },
}));

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { makeMigratedTestDatabase } from '@goodboy/db/test-helpers';
import type { Database } from '@goodboy/db';
import { brandId, type SessionId, type WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { autoTreeLimitKey, readAutoTreeLimit } from '../autoTreeLimit';
import { useAutoTreeLimit } from '.';

const HARBORLINE = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const SESSION = brandId<SessionId>({ value: 'session-harborline' });

let db: Database;

type ProbeParams = {
  readonly sessionId?: SessionId | null;
};

const Probe = ({ sessionId = null }: ProbeParams) => {
  const limit = useAutoTreeLimit({ workspaceId: HARBORLINE, sessionId });
  return (
    <div>
      <p data-testid="usd">{limit.usd}</p>
      <p data-testid="stored">{String(limit.isStored)}</p>
      <p data-testid="session">{String(limit.isFromSession)}</p>
      <button type="button" onClick={() => limit.change(9)}>
        change
      </button>
      <button type="button" onClick={() => void limit.persist()}>
        persist
      </button>
    </div>
  );
};

beforeEach(async () => {
  db = await makeMigratedTestDatabase();
  holder.db = db;
  useAppStore.setState({ settings: {}, sessionBudgets: {} });
});

afterEach(cleanup);

describe('useAutoTreeLimit', () => {
  it('proposes 5 USD until a limit is stored, then reads the stored one', async () => {
    render(<Probe />);

    expect(screen.getByTestId('usd').textContent).toBe('5');
    expect(screen.getByTestId('stored').textContent).toBe('false');
    await act(async () => {
      await db.execute('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, 0)', [
        autoTreeLimitKey({ workspaceId: HARBORLINE }),
        '12',
      ]);
      window.dispatchEvent(new Event('focus'));
    });
    cleanup();
    render(<Probe />);

    await waitFor(() => expect(screen.getByTestId('usd').textContent).toBe('12'));
    expect(screen.getByTestId('stored').textContent).toBe('true');
  });

  it('stores the proposal the first time it is persisted, so the next start is not asked', async () => {
    render(<Probe />);

    fireEvent.click(screen.getByText('persist'));

    await waitFor(() => expect(screen.getByTestId('stored').textContent).toBe('true'));
    expect(await readAutoTreeLimit({ db, workspaceId: HARBORLINE })).toBe(5);
  });

  it('stores the amount the person chose', async () => {
    render(<Probe />);

    fireEvent.click(screen.getByText('change'));
    fireEvent.click(screen.getByText('persist'));

    await waitFor(() => expect(screen.getByTestId('usd').textContent).toBe('9'));
    expect(await readAutoTreeLimit({ db, workspaceId: HARBORLINE })).toBe(9);
  });

  it('writes nothing when a limit is stored and the person changed nothing', async () => {
    await db.execute('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, 0)', [
      autoTreeLimitKey({ workspaceId: HARBORLINE }),
      '7',
    ]);
    render(<Probe />);
    await waitFor(() => expect(screen.getByTestId('usd').textContent).toBe('7'));
    const before = await db.select('SELECT updated_at FROM settings');

    fireEvent.click(screen.getByText('persist'));
    await act(async () => undefined);

    expect(await db.select('SELECT updated_at FROM settings')).toEqual(before);
  });

  it('follows a smaller session budget and never stores it as the Auto limit', async () => {
    useAppStore.setState({
      sessionBudgets: { [SESSION]: { sessionId: SESSION, softCapUsd: 2, onExceed: 'pause' } },
    });
    render(<Probe sessionId={SESSION} />);

    fireEvent.click(screen.getByText('persist'));
    await act(async () => undefined);

    expect(screen.getByTestId('usd').textContent).toBe('2');
    expect(screen.getByTestId('session').textContent).toBe('true');
    expect(await readAutoTreeLimit({ db, workspaceId: HARBORLINE })).toBeNull();
  });

  it('does not follow a smaller session budget that only warns', async () => {
    useAppStore.setState({
      sessionBudgets: { [SESSION]: { sessionId: SESSION, softCapUsd: 2, onExceed: 'warn' } },
    });
    render(<Probe sessionId={SESSION} />);

    expect(screen.getByTestId('usd').textContent).toBe('5');
    expect(screen.getByTestId('session').textContent).toBe('false');
  });

  it('keeps the smaller Auto limit under a larger session budget', async () => {
    useAppStore.setState({
      sessionBudgets: { [SESSION]: { sessionId: SESSION, softCapUsd: 25, onExceed: 'pause' } },
    });
    render(<Probe sessionId={SESSION} />);

    expect(screen.getByTestId('usd').textContent).toBe('5');
    expect(screen.getByTestId('session').textContent).toBe('false');
  });
});
