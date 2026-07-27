// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Session } from '@goodboy/types';

const { state } = vi.hoisted(() => ({
  state: {
    sessionExternalTasks: {} as Record<string, unknown>,
  },
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

vi.mock('../../../session/components/SessionStageBadge', () => ({
  SessionStageBadge: () => null,
}));

import { SessionDetailPanel } from './index';

const session: Session = {
  id: 'sess-1',
  workspaceId: 'ws-1',
  goal: 'refactor auth',
  state: { kind: 'idle' },
} as unknown as Session;

beforeEach(() => {
  state.sessionExternalTasks = {};
});
afterEach(cleanup);

describe('SessionDetailPanel', () => {
  it('renders the session goal text', () => {
    render(<SessionDetailPanel session={session} />);
    expect(screen.getByText(/refactor auth/i)).toBeDefined();
  });

  it('switches the goal into an editable field on edit click', () => {
    render(<SessionDetailPanel session={session} />);
    fireEvent.click(screen.getByRole('button', { name: /edit goal/i }));
    expect(screen.getByRole('textbox', { name: /session goal/i })).toBeDefined();
  });

  it('does not render an external task chip when none is mapped', () => {
    render(<SessionDetailPanel session={session} />);
    expect(screen.queryByRole('button', { name: /studio/i })).toBeNull();
  });

  it('renders the external task chip (full variant) when a task is mapped', () => {
    state.sessionExternalTasks = {
      'sess-1': [
        {
          sessionId: 'sess-1',
          provider: 'linear',
          externalId: 'ext-1',
          identifier: 'GB-9',
          url: 'https://linear.app/x',
          title: 'wire metadata',
          createdAt: '2026-06-22T00:00:00.000Z',
        },
      ],
    };
    render(<SessionDetailPanel session={session} />);
    expect(screen.getByRole('button', { name: /open GB-9 in Linear studio/i })).toBeDefined();
    expect(screen.getByText('GB-9')).toBeDefined();
    expect(screen.getByText('wire metadata')).toBeDefined();
  });
});
