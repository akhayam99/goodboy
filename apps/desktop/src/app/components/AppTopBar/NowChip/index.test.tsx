// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { Session, SessionId } from '@goodboy/types';

const { hooks, store } = vi.hoisted(() => ({
  hooks: {
    groups: [] as ReadonlyArray<{
      readonly key: string;
      readonly sessions: ReadonlyArray<Session>;
    }>,
    workspace: { id: 'ws-1', name: 'Harborline' } as { id: string; name: string } | null,
  },
  store: {
    setCurrentSession: vi.fn(async () => undefined),
    setActiveLens: vi.fn(),
    cancelScript: vi.fn(async () => undefined),
    scriptRuns: {} as Record<string, Record<string, unknown>>,
    sessions: [] as ReadonlyArray<Session>,
    archivedSessions: {} as Record<string, ReadonlyArray<Session>>,
    projectScripts: {} as Record<string, ReadonlyArray<{ id: string; name: string }>>,
  },
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [],
  useCurrentWorkspace: () => hooks.workspace,
  useSessions: () => store.sessions,
  useStageGroupedSessions: () => hooks.groups,
  useSessionStageInfo: () => ({ stage: 'attention', reason: 'Needs attention', attention: null }),
  useAppStore: <T,>(selector: (state: typeof store) => T) => selector(store),
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
  hooks.workspace = { id: 'ws-1', name: 'Harborline' };
  store.scriptRuns = {};
  store.sessions = [];
  store.projectScripts = {};
  store.setCurrentSession.mockClear();
  store.setActiveLens.mockClear();
  store.cancelScript.mockClear();
});

afterEach(cleanup);

const trigger = () => screen.getByRole('button', { name: /need|running/ });

const open = async () => {
  await act(async () => {
    fireEvent.click(trigger());
  });
  return screen.getByRole('dialog', { name: 'Now' });
};

describe('NowChip', () => {
  it('draws nothing when nothing needs you, runs or plays a script', () => {
    const { container } = render(<NowChip onOpenScript={vi.fn()} />);

    expect(container.firstChild).toBeNull();
  });

  it('shows only the segments above zero, and names them all in one label', () => {
    hooks.groups = [{ key: 'running', sessions: [RUNNING] }];
    const { rerender } = render(<NowChip onOpenScript={vi.fn()} />);

    expect(trigger().getAttribute('aria-label')).toBe('1 running');
    expect(screen.queryByText('need you')).toBeNull();
    expect(screen.queryByText('scripts')).toBeNull();

    hooks.groups = [
      { key: 'attention', sessions: [NEEDS, NEEDS] },
      { key: 'running', sessions: [RUNNING] },
    ];
    withScript();
    rerender(<NowChip onOpenScript={vi.fn()} />);

    expect(trigger().getAttribute('aria-label')).toBe(
      '2 sessions need you, 1 running, 1 script running',
    );
    expect(screen.getByText('need you').className).toContain('@min-chrome-labels/topbar:inline');
    expect(screen.getByText('scripts').className).toContain('@min-chrome-labels/topbar:inline');
  });

  it('groups needs you, running and scripts in one popover and skips an empty group', async () => {
    hooks.groups = [{ key: 'attention', sessions: [NEEDS] }];
    withScript();
    render(<NowChip onOpenScript={vi.fn()} />);

    const panel = await open();

    expect(within(panel).getByText('Now in Harborline')).toBeDefined();
    expect(within(panel).getByRole('list', { name: 'Needs you' })).toBeDefined();
    expect(within(panel).queryByRole('list', { name: 'Running' })).toBeNull();
    expect(within(panel).getByRole('list', { name: 'Scripts' })).toBeDefined();
  });

  it('opens a session from its row and closes', async () => {
    hooks.groups = [{ key: 'attention', sessions: [NEEDS] }];
    render(<NowChip onOpenScript={vi.fn()} />);

    const panel = await open();
    await act(async () => {
      fireEvent.click(within(panel).getByText('Pick the retry backoff for notify-relay'));
    });

    expect(store.setCurrentSession).toHaveBeenCalledWith(NEEDS.id);
    expect(screen.queryByRole('dialog', { name: 'Now' })).toBeNull();
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

  it('opens on the named popover layer and closes on escape and on the backdrop', async () => {
    hooks.groups = [{ key: 'attention', sessions: [NEEDS] }];
    render(<NowChip onOpenScript={vi.fn()} />);

    await open();
    expect(document.body.querySelector('.z-popover')).not.toBeNull();

    await act(async () => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(screen.queryByRole('dialog', { name: 'Now' })).toBeNull();
    expect(document.activeElement).not.toBe(trigger());

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
