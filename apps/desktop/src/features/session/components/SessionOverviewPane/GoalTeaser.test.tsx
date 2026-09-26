// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Session } from '@goodboy/types';

const { store } = vi.hoisted(() => ({
  store: {
    slots: [] as ReadonlyArray<{ key: string; value: string; enabled: boolean }>,
    isLoading: false,
    openContextDrawer: vi.fn(),
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (state: typeof store) => T) => selector(store),
  useSessionSlots: () => store.slots,
  useSessionLoading: () => ({ slots: store.isLoading }),
}));

import { GoalTeaser } from './GoalTeaser';

const session = { id: 'sess-1', goal: 'Invoices credited twice' } as Session;

const goal = (value: string) => [{ key: 'goal', value, enabled: true }];

beforeEach(() => {
  store.slots = [];
  store.isLoading = false;
  vi.clearAllMocks();
});
afterEach(cleanup);

describe('GoalTeaser', () => {
  it('shows one Goal line that opens the drawer on Goal', () => {
    store.slots = goal('Stop crediting an invoice twice when the provider redelivers.');
    render(<GoalTeaser session={session} />);

    const row = screen.getByRole('button', { name: /^Goal: Stop crediting/ });
    fireEvent.click(row);
    expect(store.openContextDrawer).toHaveBeenCalledWith({ sessionId: 'sess-1', tab: 'goal' });
  });

  it('stays out of the way when the goal is the title', () => {
    store.slots = goal('Invoices credited twice');
    const { container } = render(<GoalTeaser session={session} />);

    expect(container.textContent).toBe('');
  });

  it('offers Add a goal when there is none', () => {
    store.slots = goal('');
    render(<GoalTeaser session={session} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add a goal' }));
    expect(store.openContextDrawer).toHaveBeenCalledWith({ sessionId: 'sess-1', tab: 'goal' });
  });

  it('holds one line of skeleton while the goal loads', () => {
    store.isLoading = true;
    render(<GoalTeaser session={session} />);

    expect(screen.getByRole('status', { name: 'Loading goal' })).toBeDefined();
  });
});
