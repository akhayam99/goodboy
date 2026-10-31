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
import { brandId, DEFAULT_WORKFLOW_RULES, type SessionId, type WorkspaceId } from '@goodboy/types';
import { EMPTY_OVERRIDES } from '@goodboy/types/testing';
import { useAppStore } from '../../../store';
import { readAutoTreeLimit } from '../autoTreeLimit';
import type { LimitDefaultFrom } from '../limitDefaultFrom';
import { useAutoTreeLimit } from '.';

const HARBORLINE = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const SESSION = brandId<SessionId>({ value: 'session-harborline' });

let db: Database;

type ProbeParams = {
  readonly sessionId?: SessionId | null;
  readonly defaultFrom?: LimitDefaultFrom;
};

const Probe = ({ sessionId = null, defaultFrom = 'auto' }: ProbeParams) => {
  const model = useAutoTreeLimit({ workspaceId: HARBORLINE, sessionId });
  const limit = { ...model.viewOf({ defaultFrom }), persist: () => model.persist({ defaultFrom }) };
  return (
    <div>
      <p data-testid="usd">{String(limit.usd)}</p>
      <p data-testid="stored">{String(limit.isStored)}</p>
      <p data-testid="session">{String(limit.isFromSession)}</p>
      <button type="button" onClick={() => limit.change(9)}>
        change
      </button>
      <button type="button" onClick={() => limit.change(null)}>
        clear
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
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace-harborline', 'Harborline', 'harborline', 1, 1)",
  );
  useAppStore.setState({ workspaceValues: {}, sessionBudgets: {} });
});

afterEach(cleanup);

describe('useAutoTreeLimit', () => {
  it('has no limit until one is stored, then reads the stored one', async () => {
    render(<Probe />);

    expect(screen.getByTestId('usd').textContent).toBe('null');
    expect(screen.getByTestId('stored').textContent).toBe('false');
    await act(async () => {
      await db.execute(
        "INSERT INTO workspace_values (workspace_id, key, value, updated_at) VALUES (?, 'auto.treeLimitUsd', ?, 0)",
        [HARBORLINE, '12'],
      );
      window.dispatchEvent(new Event('focus'));
    });
    cleanup();
    render(<Probe />);

    await waitFor(() => expect(screen.getByTestId('usd').textContent).toBe('12'));
    expect(screen.getByTestId('stored').textContent).toBe('true');
  });

  it('stores nothing when the person set nothing, so no limit appears on its own', async () => {
    render(<Probe />);

    fireEvent.click(screen.getByText('persist'));
    await act(async () => undefined);

    expect(screen.getByTestId('stored').textContent).toBe('false');
    expect(await readAutoTreeLimit({ db, workspaceId: HARBORLINE })).toBeNull();
  });

  it('removes a stored limit when the person clears it', async () => {
    await db.execute(
      "INSERT INTO workspace_values (workspace_id, key, value, updated_at) VALUES (?, 'auto.treeLimitUsd', ?, 0)",
      [HARBORLINE, '7'],
    );
    render(<Probe />);
    await waitFor(() => expect(screen.getByTestId('usd').textContent).toBe('7'));

    fireEvent.click(screen.getByText('clear'));
    fireEvent.click(screen.getByText('persist'));

    await waitFor(() => expect(screen.getByTestId('stored').textContent).toBe('false'));
    expect(screen.getByTestId('usd').textContent).toBe('null');
    expect(await readAutoTreeLimit({ db, workspaceId: HARBORLINE })).toBeNull();
  });

  it('stores the amount the person chose', async () => {
    render(<Probe />);

    fireEvent.click(screen.getByText('change'));
    fireEvent.click(screen.getByText('persist'));

    await waitFor(() => expect(screen.getByTestId('usd').textContent).toBe('9'));
    expect(await readAutoTreeLimit({ db, workspaceId: HARBORLINE })).toBe(9);
  });

  it('writes nothing when a limit is stored and the person changed nothing', async () => {
    await db.execute(
      "INSERT INTO workspace_values (workspace_id, key, value, updated_at) VALUES (?, 'auto.treeLimitUsd', ?, 0)",
      [HARBORLINE, '7'],
    );
    render(<Probe />);
    await waitFor(() => expect(screen.getByTestId('usd').textContent).toBe('7'));
    const before = await db.select('SELECT updated_at FROM workspace_values');

    fireEvent.click(screen.getByText('persist'));
    await act(async () => undefined);

    expect(await db.select('SELECT updated_at FROM workspace_values')).toEqual(before);
  });

  it('follows a smaller session budget and never stores it as the Auto limit', async () => {
    useAppStore.setState({
      sessionBudgets: {
        [SESSION]: { sessionId: SESSION, softCapUsd: 2, onExceed: 'pause', warnRatio: 0.8 },
      },
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
      sessionBudgets: {
        [SESSION]: { sessionId: SESSION, softCapUsd: 2, onExceed: 'warn', warnRatio: 0.8 },
      },
    });
    render(<Probe sessionId={SESSION} />);

    expect(screen.getByTestId('usd').textContent).toBe('null');
    expect(screen.getByTestId('session').textContent).toBe('false');
  });

  it('keeps the smaller Auto limit under a larger session budget', async () => {
    useAppStore.setState({
      sessionBudgets: {
        [SESSION]: { sessionId: SESSION, softCapUsd: 25, onExceed: 'pause', warnRatio: 0.8 },
      },
    });
    await db.execute(
      "INSERT INTO workspace_values (workspace_id, key, value, updated_at) VALUES (?, 'auto.treeLimitUsd', ?, 0)",
      [HARBORLINE, '5'],
    );
    render(<Probe sessionId={SESSION} />);

    await waitFor(() => expect(screen.getByTestId('usd').textContent).toBe('5'));
    expect(screen.getByTestId('session').textContent).toBe('false');
  });

  describe('starting from the Run defaults', () => {
    const withRunDefault = (usd: number | null): void => {
      useAppStore.setState({
        workspaceOverrides: {
          [HARBORLINE]: {
            ...EMPTY_OVERRIDES,
            workflowRules: { ...DEFAULT_WORKFLOW_RULES, spendLimitUsd: usd },
          },
        },
      });
    };

    it('shows the Run defaults amount, not the Auto limit, tagged as the default', async () => {
      withRunDefault(6);
      await db.execute(
        "INSERT INTO workspace_values (workspace_id, key, value, updated_at) VALUES (?, 'auto.treeLimitUsd', ?, 0)",
        [HARBORLINE, '12'],
      );
      render(<Probe defaultFrom="run" />);

      await waitFor(() => expect(screen.getByTestId('usd').textContent).toBe('6'));
      expect(screen.getByTestId('stored').textContent).toBe('true');
    });

    it('keeps an amount typed on a run for a retry and never writes the Auto limit', async () => {
      withRunDefault(6);
      render(<Probe defaultFrom="run" />);

      fireEvent.click(screen.getByText('change'));
      fireEvent.click(screen.getByText('persist'));
      await act(async () => undefined);

      expect(screen.getByTestId('usd').textContent).toBe('9');
      expect(await readAutoTreeLimit({ db, workspaceId: HARBORLINE })).toBeNull();
    });

    it('has no limit when Run defaults has none', async () => {
      withRunDefault(null);
      render(<Probe defaultFrom="run" />);

      expect(screen.getByTestId('usd').textContent).toBe('null');
      expect(screen.getByTestId('stored').textContent).toBe('false');
    });
  });
});
