// @vitest-environment happy-dom

import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';

const { store } = vi.hoisted(() => ({
  store: {
    status: 'idle' as 'idle' | 'running' | 'error',
    drawer: null as unknown,
    currentSessionId: 'sess-1',
    sessionDecisions: {} as Record<string, ReadonlyArray<unknown>>,
    sessionContextSeenAt: {} as Record<string, string | null>,
    toggleContextDrawer: vi.fn(),
    loadSessionContextSeen: vi.fn(async () => undefined),
    loadSessionDecisions: vi.fn(async () => undefined),
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (state: typeof store) => T) => selector(store),
  useSummarizerStatus: () => ({ status: store.status }),
}));

vi.mock('@goodboy/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@goodboy/ui')>()),
  Tooltip: ({ content, children }: { content: string; children: ReactNode }) => (
    <span data-tooltip={content}>{children}</span>
  ),
}));

import { ContextChip } from './ContextChip';

const SID = 'sess-1' as SessionId;

const chip = () => screen.getByTestId('context-chip');

beforeEach(() => {
  store.status = 'idle';
  store.drawer = null;
  store.sessionDecisions = {};
  store.sessionContextSeenAt = {};
  vi.clearAllMocks();
});
afterEach(cleanup);

describe('ContextChip', () => {
  it('rests as Context and toggles the drawer', () => {
    render(<ContextChip sessionId={SID} />);

    expect(chip().textContent).toBe('Context');
    expect(chip().getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(chip());
    expect(store.toggleContextDrawer).toHaveBeenCalledWith({ sessionId: SID });
    expect(store.loadSessionContextSeen).toHaveBeenCalledWith(SID);
    expect(store.loadSessionDecisions).toHaveBeenCalledWith(SID);
  });

  it('shows a quiet dot, never a count, and opens on decisions', () => {
    store.sessionContextSeenAt = { [SID]: '2026-09-26T10:00:00.000Z' };
    store.sessionDecisions = {
      [SID]: [
        {
          number: 1,
          status: 'active',
          author: 'agent',
          closedBy: null,
          previousText: null,
          rewordedAt: null,
          createdAt: '2026-09-26T11:00:00.000Z',
          updatedAt: '2026-09-26T11:00:00.000Z',
        },
      ],
    };
    render(<ContextChip sessionId={SID} />);

    expect(chip().textContent).toBe('Context');
    expect(screen.getByLabelText('Changed since you last looked')).toBeDefined();
    fireEvent.click(chip());
    expect(store.toggleContextDrawer).toHaveBeenCalledWith({ sessionId: SID, tab: 'decisions' });
  });

  it('reads pressed while the drawer is open', () => {
    store.drawer = { kind: 'context', sessionId: SID, payload: { tab: 'goal', view: 'current' } };
    render(<ContextChip sessionId={SID} />);

    expect(chip().getAttribute('aria-pressed')).toBe('true');
  });

  it('says it is updating, or that the update failed', () => {
    store.status = 'running';
    const { unmount } = render(<ContextChip sessionId={SID} />);
    expect(screen.getByLabelText('Updating context')).toBeDefined();
    unmount();

    store.status = 'error';
    const { container } = render(<ContextChip sessionId={SID} />);
    expect(container.querySelector('[data-tooltip]')?.getAttribute('data-tooltip')).toBe(
      "Couldn't update the context. Open to retry.",
    );
  });
});
