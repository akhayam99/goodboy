// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sessionPlace } from '../../../../store/slices/navigation/place';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { Session, SessionId } from '@goodboy/types';

type Attention = {
  count: number;
  quietCount: number;
  tone: 'danger' | 'warning' | null;
  countedIds: ReadonlyArray<string>;
  reasons: ReadonlyArray<string>;
  quietReasons: ReadonlyArray<string>;
  countedSessions: ReadonlyArray<Session>;
};

const { hooks, store, noAttention } = vi.hoisted(() => {
  const noAttention = (): Attention => ({
    count: 0,
    quietCount: 0,
    tone: null,
    countedIds: [],
    reasons: [],
    quietReasons: [],
    countedSessions: [],
  });
  return {
    noAttention,
    hooks: {
      groups: [] as ReadonlyArray<{
        readonly key: string;
        readonly sessions: ReadonlyArray<Session>;
      }>,
      workspace: { id: 'ws-1', name: 'Harborline' } as { id: string; name: string } | null,
      attention: noAttention(),
    },
    store: {
      navigate: vi.fn(),
      openStudio: vi.fn(),
      cancelScript: vi.fn(async () => undefined),
      scriptRuns: {} as Record<string, Record<string, unknown>>,
      sessions: [] as ReadonlyArray<Session>,
      archivedSessions: {} as Record<string, ReadonlyArray<Session>>,
      projectScripts: {} as Record<string, ReadonlyArray<{ id: string; name: string }>>,
    },
  };
});

vi.mock('../../../../store', async () => {
  const useAppStore = Object.assign(<T,>(selector: (state: typeof store) => T) => selector(store), {
    getState: () => store,
  });
  return {
    ...(await import('../../../../store/slices/navigation/place')),
    EMPTY_ARRAY: [],
    useCurrentWorkspace: () => hooks.workspace,
    useSessions: () => store.sessions,
    useStageGroupedSessions: () => hooks.groups,
    useWorkspaceAttention: () => hooks.attention,
    useSessionStageInfo: () => ({ stage: 'attention', reason: 'Needs attention', attention: null }),
    useAppStore,
  };
});

vi.mock('../../../../features/workspace/components/SessionHoverCard', () => ({
  SessionHoverCard: ({ session }: { readonly session: Session | null }) =>
    session === null ? null : <div data-testid="session-hover-card">{session.goal}</div>,
}));

import { NowChip } from './index';

const session = ({ id, goal }: { readonly id: string; readonly goal: string }) =>
  ({ id: id as SessionId, goal, workspaceId: 'ws-1' }) as unknown as Session;

const NEEDS = session({ id: 'session-needs', goal: 'Pick the retry backoff for notify-relay' });
const RUNNING = session({ id: 'session-running', goal: 'Retry failed webhook deliveries' });

const withScript = () => {
  store.sessions = [RUNNING];
  store.projectScripts = { 'ws-1': [{ id: 'script-1', name: 'pnpm dev' }] };
  store.scriptRuns = {
    [RUNNING.id]: {
      'script-1': { status: 'pending', runId: 'run-1', startedAt: Date.now() },
    },
  };
};

beforeEach(() => {
  hooks.groups = [];
  hooks.attention = noAttention();
  hooks.workspace = { id: 'ws-1', name: 'Harborline' };
  store.scriptRuns = {};
  store.sessions = [];
  store.projectScripts = {};
  store.navigate.mockClear();
  store.openStudio.mockClear();
  store.cancelScript.mockClear();
});

afterEach(cleanup);

const needing = (...sessions: ReadonlyArray<Session>): void => {
  hooks.attention = {
    count: sessions.length,
    quietCount: 0,
    tone: 'warning',
    countedIds: sessions.map((entry) => entry.id),
    reasons: ['1 question for you'],
    quietReasons: [],
    countedSessions: sessions,
  };
};

const trigger = () => screen.getByRole('button', { name: /running/ });

const open = async () => {
  await act(async () => {
    fireEvent.click(trigger());
  });
  return screen.getByRole('dialog', { name: 'Now' });
};

describe('NowChip', () => {
  it('draws one muted Idle slot, never nothing, when no session runs and no script plays', () => {
    const { container } = render(<NowChip onOpenScript={vi.fn()} />);

    const slot = container.querySelector('[data-now-idle]');
    expect(slot?.textContent).toBe('Idle');
    expect(slot?.className).toContain('text-muted-foreground');
    expect(screen.queryByRole('button', { name: /running/ })).toBeNull();
  });

  it('shows only the segments above zero, and names them all in one label', () => {
    hooks.groups = [{ key: 'running', sessions: [RUNNING] }];
    const { container, rerender } = render(<NowChip onOpenScript={vi.fn()} />);

    expect(trigger().getAttribute('aria-label')).toBe('1 session running');
    expect(container.querySelector('[data-now-idle]')).toBeNull();
    expect(screen.queryByText('scripts')).toBeNull();

    withScript();
    rerender(<NowChip onOpenScript={vi.fn()} />);

    expect(trigger().getAttribute('aria-label')).toBe('1 session running, 1 script running');
    expect(screen.getByText('scripts').className).toContain('@min-chrome-labels/topbar:inline');
  });

  it('leaves needs you to the Sessions door and the Overview: no segment, no group, no next button', async () => {
    hooks.groups = [{ key: 'running', sessions: [RUNNING] }];
    needing(NEEDS, session({ id: 'session-needs-2', goal: 'Choose the retry window' }));
    withScript();
    const { container } = render(<NowChip onOpenScript={vi.fn()} />);

    expect(trigger().getAttribute('aria-label')).toBe('1 session running, 1 script running');
    expect(container.querySelector('[data-now-needs-you]')).toBeNull();
    const panel = await open();
    expect(within(panel).queryByRole('list', { name: 'Needs you' })).toBeNull();
    expect(within(panel).queryByText('Pick the retry backoff for notify-relay')).toBeNull();
    expect(within(panel).queryByRole('button', { name: 'Next that needs you' })).toBeNull();
    within(panel).getByRole('list', { name: 'Running' });
    within(panel).getByRole('list', { name: 'Scripts' });
  });

  it('opens a session from its row and closes', async () => {
    hooks.groups = [{ key: 'running', sessions: [RUNNING] }];
    render(<NowChip onOpenScript={vi.fn()} />);

    const panel = await open();
    await act(async () => {
      fireEvent.click(within(panel).getByText('Retry failed webhook deliveries'));
    });

    expect(store.navigate).toHaveBeenCalledWith({ to: sessionPlace({ sessionId: RUNNING.id }) });
    expect(screen.queryByRole('dialog', { name: 'Now' })).toBeNull();
  });

  it('ends on Open Monitoring, the home of the numbers it counts, and closes', async () => {
    hooks.groups = [{ key: 'running', sessions: [RUNNING] }];
    render(<NowChip onOpenScript={vi.fn()} />);

    const panel = await open();
    await act(async () => {
      fireEvent.click(within(panel).getByRole('button', { name: 'Open Monitoring' }));
    });

    expect(store.openStudio).toHaveBeenCalledWith({ studio: { kind: 'monitoring' } });
    expect(screen.queryByRole('dialog', { name: 'Now' })).toBeNull();
  });

  it('names a session with a blank goal the way every session row does', async () => {
    const blank = session({ id: 'session-blank', goal: '   ' });
    hooks.groups = [{ key: 'running', sessions: [blank] }];
    render(<NowChip onOpenScript={vi.fn()} />);

    const panel = await open();

    within(panel).getByRole('button', { name: /Untitled session/ });
  });

  it('opens the session hover card for a row after the pointer rests and drops it on leave', async () => {
    hooks.groups = [{ key: 'running', sessions: [RUNNING] }];
    render(<NowChip onOpenScript={vi.fn()} />);
    const panel = await open();
    const row = within(panel).getByRole('button', { name: /Retry failed webhook deliveries/ });

    vi.useFakeTimers();
    fireEvent.mouseEnter(row);
    expect(screen.queryByTestId('session-hover-card')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByTestId('session-hover-card').textContent).toBe(
      'Retry failed webhook deliveries',
    );

    fireEvent.mouseLeave(row);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByTestId('session-hover-card')).toBeNull();
    vi.useRealTimers();
  });

  it('closes the hover card with the popover', async () => {
    hooks.groups = [{ key: 'running', sessions: [RUNNING] }];
    render(<NowChip onOpenScript={vi.fn()} />);
    const panel = await open();
    const row = within(panel).getByRole('button', { name: /Retry failed webhook deliveries/ });

    vi.useFakeTimers();
    fireEvent.mouseEnter(row);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByTestId('session-hover-card')).toBeDefined();
    vi.useRealTimers();

    await act(async () => {
      fireEvent.click(row);
    });

    expect(screen.queryByTestId('session-hover-card')).toBeNull();
  });

  it('hands a script row to the open callback and stops it in place', async () => {
    withScript();
    const onOpenScript = vi.fn();
    render(<NowChip onOpenScript={onOpenScript} />);

    let panel = await open();
    await act(async () => {
      fireEvent.click(within(panel).getByRole('button', { name: 'Stop pnpm dev' }));
    });
    expect(store.cancelScript).toHaveBeenCalledWith(RUNNING.id, 'script-1');
    expect(screen.getByRole('dialog', { name: 'Now' })).toBeDefined();

    panel = screen.getByRole('dialog', { name: 'Now' });
    await act(async () => {
      fireEvent.click(
        within(panel).getByRole('button', {
          name: 'Show pnpm dev output from Retry failed webhook deliveries',
        }),
      );
    });

    expect(onOpenScript).toHaveBeenCalledOnce();
    expect(onOpenScript.mock.calls[0]?.[0]).toMatchObject({
      sessionId: RUNNING.id,
      scriptId: 'script-1',
    });
    expect(screen.queryByRole('dialog', { name: 'Now' })).toBeNull();
  });

  it('opens on the named popover layer, closes on escape with focus back, and on the backdrop', async () => {
    hooks.groups = [{ key: 'running', sessions: [RUNNING] }];
    render(<NowChip onOpenScript={vi.fn()} />);

    await open();
    expect(document.body.querySelector('.z-popover')).not.toBeNull();

    await act(async () => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(screen.queryByRole('dialog', { name: 'Now' })).toBeNull();
    expect(document.activeElement).toBe(trigger());

    await open();
    const backdrop = document.body.querySelector('.z-popover-backdrop');
    expect(backdrop).not.toBeNull();
    await act(async () => {
      fireEvent.click(backdrop as Element);
    });
    expect(screen.queryByRole('dialog', { name: 'Now' })).toBeNull();
  });

  it('leaves session signals out without a workspace but still shows scripts', () => {
    hooks.workspace = null;
    hooks.groups = [{ key: 'attention', sessions: [NEEDS] }];
    withScript();
    render(<NowChip onOpenScript={vi.fn()} />);

    expect(trigger().getAttribute('aria-label')).toBe('1 script running');
  });
});
