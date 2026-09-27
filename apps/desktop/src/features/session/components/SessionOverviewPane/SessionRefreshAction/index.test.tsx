// @vitest-environment happy-dom

import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';

const SESSION_ID = 'session-1' as SessionId;

const { store } = vi.hoisted(() => ({
  store: {
    sessionSyncing: {} as Record<string, true>,
    resyncSession: vi.fn<(params: { readonly sessionId: string }) => Promise<void>>(),
    reportError: vi.fn(async () => undefined),
  },
}));

vi.mock('../../../../../store', () => ({
  useAppStore: <T,>(selector: (state: typeof store) => T) => selector(store),
}));
vi.mock('@goodboy/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@goodboy/ui')>();
  return { ...actual, Tooltip: ({ children }: { readonly children: ReactNode }) => children };
});

import { REFRESH_FAILED_TITLE } from '../../../hooks/useSessionRefresh';
import { SessionRefreshAction } from './index';

afterEach(cleanup);

beforeEach(() => {
  store.sessionSyncing = {};
  store.resyncSession.mockReset();
  store.resyncSession.mockResolvedValue(undefined);
  store.reportError.mockClear();
});

describe('SessionRefreshAction', () => {
  it('re-reads the session when clicked', async () => {
    render(<SessionRefreshAction sessionId={SESSION_ID} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    });

    expect(store.resyncSession).toHaveBeenCalledWith({ sessionId: SESSION_ID });
    expect(store.reportError).not.toHaveBeenCalled();
  });

  it('shows the busy glyph in place and ignores clicks while running', () => {
    store.sessionSyncing = { [SESSION_ID]: true };
    render(<SessionRefreshAction sessionId={SESSION_ID} />);

    const button = screen.getByRole('button', { name: 'Refreshing' });
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.querySelector('svg')?.getAttribute('class')).toContain('animate-soft-pulse');
    expect((button as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(button);

    expect(store.resyncSession).not.toHaveBeenCalled();
  });

  it('raises an error toast when the refresh fails', async () => {
    const failure = new Error('gh: API rate limit exceeded');
    store.resyncSession.mockRejectedValue(failure);
    render(<SessionRefreshAction sessionId={SESSION_ID} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    });

    expect(store.reportError).toHaveBeenCalledWith({
      title: REFRESH_FAILED_TITLE,
      error: failure,
      sessionId: SESSION_ID,
    });
  });
});
