// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';

const { state } = vi.hoisted(() => ({
  state: { sessionCost: 0 },
}));

vi.mock('../../../../store', () => ({
  useSessionCost: () => state.sessionCost,
}));

import { SessionCostChip } from './SessionCostChip';

const SID = 'sess-1' as SessionId;

beforeEach(() => {
  state.sessionCost = 0;
});
afterEach(cleanup);

describe('SessionCostChip', () => {
  it('shows $0 when there is no telemetry', () => {
    render(<SessionCostChip sessionId={SID} />);
    expect(screen.getByRole('button').textContent).toBe('$0');
  });

  it('formats the session cost', () => {
    state.sessionCost = 1.75;
    render(<SessionCostChip sessionId={SID} />);
    expect(screen.getByRole('button').textContent).toBe('$1.75');
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
