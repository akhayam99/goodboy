// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Session } from '@goodboy/types';

const { state } = vi.hoisted(() => ({
  state: {
    sessionsSidebarCollapsed: false,
    setSessionsSidebarCollapsed: vi.fn(),
  },
}));

vi.mock('../../../../../store', () => ({
  useAppStore: <T,>(selector: (store: typeof state) => T) => selector(state),
}));

vi.mock('../../../../workspace/components/SessionDetailPanel', () => ({
  SessionDetailPanel: () => <div>session details</div>,
}));

import { SessionTopBar } from './SessionTopBar';

const SESSION = { goal: 'test session' } as Session;

beforeEach(() => {
  state.sessionsSidebarCollapsed = false;
  state.setSessionsSidebarCollapsed.mockClear();
});

afterEach(cleanup);

describe('SessionTopBar', () => {
  it('does not render the reopen button while the sessions sidebar is visible', () => {
    render(<SessionTopBar session={SESSION} />);
    expect(screen.queryByRole('button', { name: 'show sessions' })).toBeNull();
  });

  it('reopens the sessions sidebar from an open session', () => {
    state.sessionsSidebarCollapsed = true;
    render(<SessionTopBar session={SESSION} />);
    fireEvent.click(screen.getByRole('button', { name: 'show sessions' }));
    expect(state.setSessionsSidebarCollapsed).toHaveBeenCalledWith(false);
  });
});
