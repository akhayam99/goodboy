// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';

const { state, sessions } = vi.hoisted(() => ({
  state: { navigate: vi.fn() },
  sessions: new Map<string, Record<string, unknown>>(),
}));

vi.mock('../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
  useSessionById: (id: string) => sessions.get(id) ?? null,
  useSessionStageInfo: () => ({ stage: 'done', reason: '', attention: null, prState: null }),
  sessionPlace: ({ sessionId }: { readonly sessionId: string }) => ({ kind: 'session', sessionId }),
}));

import { SessionChip } from './index';

afterEach(cleanup);

describe('SessionChip', () => {
  it('shows the title and stage word and opens the session', () => {
    sessions.set('session-close', { id: 'session-close', goal: 'Close the ledger month' });
    render(<SessionChip sessionId={'session-close' as SessionId} />);

    fireEvent.click(screen.getByRole('button', { name: /Close the ledger month/ }));

    expect(screen.getByText('· done')).toBeDefined();
    expect(state.navigate).toHaveBeenCalledWith({
      to: { kind: 'session', sessionId: 'session-close' },
    });
  });

  it('says No session when the session is gone', () => {
    render(<SessionChip sessionId={'session-gone' as SessionId} />);

    expect(screen.getByText('No session')).toBeDefined();
  });
});
