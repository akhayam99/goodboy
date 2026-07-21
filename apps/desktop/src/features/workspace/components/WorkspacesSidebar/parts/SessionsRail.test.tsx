// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const { state } = vi.hoisted(() => ({
  state: {
    toggleSessionsSidebar: vi.fn(),
    setCurrentSession: vi.fn(),
  },
}));

vi.mock('../../../../../store', () => ({
  useAppStore: <T,>(selector: (store: typeof state) => T) => selector(state),
}));

import { SessionsRail } from './SessionsRail';

beforeEach(() => {
  state.toggleSessionsSidebar.mockClear();
  state.setCurrentSession.mockClear();
});

afterEach(cleanup);

describe('SessionsRail', () => {
  it('renders the three collapsed sidebar actions', () => {
    render(<SessionsRail />);
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  it('expands the sessions sidebar', () => {
    render(<SessionsRail />);
    fireEvent.click(screen.getByRole('button', { name: 'show sessions' }));
    expect(state.toggleSessionsSidebar).toHaveBeenCalledOnce();
  });

  it('returns to the board', () => {
    render(<SessionsRail />);
    fireEvent.click(screen.getByRole('button', { name: 'back to board' }));
    expect(state.setCurrentSession).toHaveBeenCalledWith(null);
  });
});
