// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { brandId, type Session, type SessionId, type WorkflowRunId } from '@goodboy/types';
import { aSession, aWorkflowRun } from '@goodboy/types/testing';

const SESSION_ID = 'session-1' as SessionId;

const { store } = vi.hoisted(() => {
  const noRows = (): Record<string, ReadonlyArray<unknown>> => ({});
  return {
    store: {
      currentWorkspaceId: 'ws-1',
      currentSessionId: null as string | null,
      openSessionDraftWorkspaceId: null as string | null,
      appStudio: null as { readonly kind: string } | null,
      sessions: [] as ReadonlyArray<Session>,
      sessionPhaseRuns: noRows(),
      sessionWorkflows: noRows(),
      phaseTemplates: noRows(),
      navigation: {} as Record<string, unknown>,
      back: vi.fn(),
      forward: vi.fn(),
      goToHistory: vi.fn(),
      navigate: vi.fn(),
      closeStudio: vi.fn(),
      switchStudio: vi.fn(),
    },
  };
});

vi.mock('../../../../store', () => ({
  BOARD_PLACE: { at: 'board' },
  useAppStore: Object.assign(<T,>(selector: (state: typeof store) => T) => selector(store), {
    getState: () => store,
  }),
}));

vi.mock('@goodboy/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@goodboy/ui')>();
  return {
    ...actual,
    Tooltip: ({
      content,
      shortcut,
      children,
    }: {
      content: string;
      shortcut?: string;
      children: React.ReactNode;
    }) => (
      <span data-tooltip={content} data-shortcut={shortcut}>
        {children}
      </span>
    ),
  };
});

import { NavCluster } from './index';

const sessionView = (lens: string | null) => ({
  workspaceId: 'ws-1',
  place: {
    at: 'session',
    sessionId: SESSION_ID,
    view: { lens, agentId: null, target: null },
  },
  studio: null,
  focus: { drawer: null, scroll: {} },
});

const BOARD_ENTRY = {
  workspaceId: 'ws-1',
  place: { at: 'board' },
  studio: null,
  focus: { drawer: null, scroll: {} },
};

beforeEach(() => {
  store.currentSessionId = null;
  store.openSessionDraftWorkspaceId = null;
  store.appStudio = null;
  store.navigation = {};
  store.sessionPhaseRuns = {};
  store.sessions = [{ id: SESSION_ID, goal: 'Retry failed webhook deliveries' } as Session];
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('NavCluster', () => {
  it('disables Previous with nothing behind, and names the destination when there is one', () => {
    render(<NavCluster />);
    const back = screen.getByRole('button', { name: 'Previous' });
    expect(back.getAttribute('aria-disabled')).toBe('true');
    expect(back.parentElement?.getAttribute('data-tooltip')).toBe('Nothing to go back to');
    fireEvent.click(back);
    expect(store.back).not.toHaveBeenCalled();

    cleanup();
    store.navigation = { 'ws-1': { entries: [sessionView('review'), BOARD_ENTRY], index: 1 } };
    render(<NavCluster />);
    const live = screen.getByRole('button', { name: 'Previous: Comments' });
    expect(live.parentElement?.getAttribute('data-tooltip')).toContain(
      'Previous: Comments\nRetry failed webhook deliveries',
    );
    fireEvent.click(live);
    expect(store.back).toHaveBeenCalledOnce();
  });

  it('names the agent and the run an entry shows, even from another session', () => {
    const OTHER_ID = brandId<SessionId>({ value: 'session-2' });
    store.sessions = [
      aSession({
        id: SESSION_ID,
        goal: 'Retry failed webhook deliveries',
        workflowRuns: [
          aWorkflowRun({
            id: brandId<WorkflowRunId>({ value: 'run-relay' }),
            title: 'Retry the relay on 503',
          }),
        ],
      }),
      aSession({ id: OTHER_ID, goal: 'Guard the settlement batch', workflowRuns: [] }),
    ];
    store.sessionPhaseRuns = {
      [SESSION_ID]: [{ id: 'agent-tester', name: 'Tester', kind: 'tester' }],
    };
    const agentEntry = {
      ...sessionView('workflows'),
      place: {
        at: 'session',
        sessionId: SESSION_ID,
        view: { lens: 'workflows', agentId: 'agent-tester', target: null },
      },
    };
    const runEntry = {
      ...sessionView('workflows'),
      place: {
        at: 'session',
        sessionId: SESSION_ID,
        view: { lens: 'workflows', agentId: null, target: { kind: 'run', runId: 'run-relay' } },
      },
    };
    const otherEntry = {
      ...sessionView(null),
      place: {
        at: 'session',
        sessionId: OTHER_ID,
        view: { lens: null, agentId: null, target: null },
      },
    };
    store.navigation = { 'ws-1': { entries: [runEntry, agentEntry, otherEntry], index: 2 } };
    render(<NavCluster />);

    const previous = screen.getByRole('button', { name: /^Previous: / });
    expect(previous.getAttribute('aria-label')).toBe('Previous: Tester');
    expect(previous.parentElement?.getAttribute('data-tooltip')).toBe(
      'Previous: Tester\nRetry failed webhook deliveries',
    );
    fireEvent.contextMenu(previous);
    expect(screen.getAllByRole('menuitemradio').map((item) => item.textContent)).toEqual([
      'OverviewGuard the settlement batch',
      'TesterRetry failed webhook deliveries',
      'Retry the relay on 503Retry failed webhook deliveries',
    ]);
  });

  it('opens the recent history on right click and jumps to an entry', () => {
    store.navigation = {
      'ws-1': { entries: [sessionView(null), sessionView('review'), BOARD_ENTRY], index: 2 },
    };
    render(<NavCluster />);

    fireEvent.contextMenu(screen.getByRole('button', { name: 'Previous: Comments' }));
    const items = screen.getAllByRole('menuitemradio');
    expect(items.map((item) => item.textContent)).toEqual([
      'Board',
      'CommentsRetry failed webhook deliveries',
      'OverviewRetry failed webhook deliveries',
    ]);
    expect(items[0]?.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(items[2] as HTMLElement);
    expect(store.goToHistory).toHaveBeenCalledWith({ index: 0 });
  });
});
