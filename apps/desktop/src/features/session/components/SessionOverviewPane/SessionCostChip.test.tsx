// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { BudgetAlert, SessionId } from '@goodboy/types';

type Store = {
  budgetAlerts: ReadonlyArray<BudgetAlert>;
};

const { state, store } = vi.hoisted(() => ({
  state: { sessionCost: 0 },
  store: { budgetAlerts: [] } as { budgetAlerts: ReadonlyArray<BudgetAlert> },
}));

vi.mock('../../../../store', () => ({
  useSessionCost: () => state.sessionCost,
  useAppStore: <T,>(selector: (s: Store) => T) => selector(store),
}));

import { SessionCostChip } from './SessionCostChip';

const SID = 'sess-1' as SessionId;

const alert = (over: Partial<BudgetAlert> = {}): BudgetAlert =>
  ({
    id: 'alert-1',
    kind: 'session-threshold',
    sessionId: SID,
    currentUsd: 1.75,
    capUsd: 5,
    createdAt: '2026-07-27T10:00:00.000Z',
    ...over,
  }) as BudgetAlert;

beforeEach(() => {
  state.sessionCost = 0;
  store.budgetAlerts = [];
});
afterEach(cleanup);

describe('SessionCostChip', () => {
  it('shows $0 when there is no telemetry', () => {
    render(<SessionCostChip sessionId={SID} />);
    expect(screen.getByRole('button').textContent).toBe('$0');
  });

  it('shows the spend alone when no cap is known', () => {
    state.sessionCost = 1.75;
    render(<SessionCostChip sessionId={SID} />);
    expect(screen.getByRole('button').textContent).toBe('$1.75');
  });

  it('shows spend against the cap carried by the session budget alert', () => {
    state.sessionCost = 1.75;
    store.budgetAlerts = [alert()];
    render(<SessionCostChip sessionId={SID} />);
    expect(screen.getByRole('button').textContent).toBe('$1.75 / $5.00');
  });

  it('ignores a cap belonging to another session or to a provider', () => {
    state.sessionCost = 1.75;
    store.budgetAlerts = [
      alert({ sessionId: 'sess-2' as SessionId, capUsd: 9 }),
      alert({ kind: 'provider-exceeded', sessionId: undefined, capUsd: 40 }),
    ];
    render(<SessionCostChip sessionId={SID} />);
    expect(screen.getByRole('button').textContent).toBe('$1.75');
  });

  it('keeps the exact cost in the tooltip', () => {
    state.sessionCost = 1.7562;
    render(<SessionCostChip sessionId={SID} />);
    expect(screen.getByRole('button').getAttribute('title')).toContain('$1.7562');
  });

  it('keeps a sub-cent cap exact in the tooltip too', () => {
    state.sessionCost = 0.0012;
    store.budgetAlerts = [alert({ capUsd: 0.005 })];
    const title = render(<SessionCostChip sessionId={SID} />)
      .container.querySelector('button')
      ?.getAttribute('title');
    expect(title).toContain('$0.0012');
    expect(title).toContain('of a $0.0050 cap');
  });

  it('dispatches the budget-studio event scoped to the session on click', () => {
    const handler = vi.fn();
    window.addEventListener('goodboy:open-budget-studio', handler);
    render(<SessionCostChip sessionId={SID} />);
    fireEvent.click(screen.getByRole('button'));
    expect(handler).toHaveBeenCalledOnce();
    const evt = handler.mock.calls[0]![0] as CustomEvent;
    expect(evt.detail).toEqual({ scope: { kind: 'session', sessionId: SID } });
    window.removeEventListener('goodboy:open-budget-studio', handler);
  });
});
