// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Session, SessionId, WorktreeStatus } from '@goodboy/types';

type PushResult = { ok: true } | { ok: false; error: string };

const h = vi.hoisted(() => ({
  state: {
    sessions: [
      {
        id: 'session-1',
        workspaceId: 'workspace-1',
        providerPreference: { defaultProvider: 'anthropic' },
      },
    ],
    workspaceOverrides: {},
    sessionPhaseRuns: {} as Record<
      string,
      ReadonlyArray<{ id: string; name: string; status: string }>
    >,
    sessionCreations: {},
    spawnAgent: vi.fn(async () => 'agent-1'),
    selectAgent: vi.fn(async () => undefined),
    setActiveLens: vi.fn(),
    emitNotification: vi.fn(async () => undefined),
    pushSessionBranch: vi.fn(async (): Promise<PushResult> => ({ ok: true })),
    beginSessionCreation: vi.fn(() => 'creation-1'),
    endSessionCreation: vi.fn(),
  },
  worktreeStatus: vi.fn(
    async (): Promise<WorktreeStatus> =>
      ({
        upstreamDistance: { kind: 'known', ahead: 1, behind: 0 },
        mainDistance: { kind: 'known', ahead: 0, behind: 2 },
      }) as unknown as WorktreeStatus,
  ),
}));

vi.mock('../../../../../store', () => ({
  useAppStore: <T,>(selector: (state: typeof h.state) => T) => selector(h.state),
}));

vi.mock('../../../../worktree/worktree', () => ({
  worktreeStatus: h.worktreeStatus,
}));

vi.mock('../../../../../store/slices/worktrees/resolveSessionRepo', () => ({
  resolveSessionRepo: () => ({
    worktreePath: '/repo/.goodboy/worktrees/card-config',
    mountName: null,
  }),
}));

vi.mock('../../../components/AgentSpawnConfig/taskModelAgentSpawnConfig', () => ({
  taskModelAgentSpawnConfig: () => ({
    provider: 'anthropic',
    model: 'haiku-4.5',
    effort: 'low',
    hint: '',
  }),
}));

import { ToastProvider } from '../../../../../app/components/Toast';
import { SessionGitActions } from './SessionGitActions';

const SESSION_ID = 'session-1' as SessionId;

const session = { id: SESSION_ID, workspaceId: 'workspace-1' } as unknown as Session;

const renderActions = () =>
  render(
    <ToastProvider>
      <SessionGitActions session={session} />
    </ToastProvider>,
  );

const openMenu = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Branch actions' }));
};

beforeEach(() => {
  h.state.sessionPhaseRuns = {};
  h.state.spawnAgent.mockClear();
  h.state.selectAgent.mockClear();
  h.state.setActiveLens.mockClear();
  h.state.pushSessionBranch.mockClear();
  h.state.pushSessionBranch.mockResolvedValue({ ok: true });
  h.state.beginSessionCreation.mockClear();
  h.state.endSessionCreation.mockClear();
});

afterEach(cleanup);

describe('SessionGitActions', () => {
  it('keeps the user in place when the rebase starts and opens the agent only from the toast action', async () => {
    const { rerender } = renderActions();
    openMenu();
    await waitFor(() =>
      expect(
        (screen.getByRole('menuitem', { name: 'Rebase on main' }) as HTMLButtonElement).disabled,
      ).toBe(false),
    );

    fireEvent.click(screen.getByRole('menuitem', { name: 'Rebase on main' }));

    await waitFor(() => expect(screen.getByText('Rebase started')).toBeDefined());
    expect(h.state.spawnAgent).toHaveBeenCalledWith(
      SESSION_ID,
      expect.objectContaining({ focus: 'none' }),
    );
    expect(h.state.selectAgent).not.toHaveBeenCalled();

    h.state.sessionPhaseRuns = {
      [SESSION_ID]: [{ id: 'agent-1', name: 'Rebase on main', status: 'completed' }],
    };
    rerender(
      <ToastProvider>
        <SessionGitActions session={session} />
      </ToastProvider>,
    );

    const action = await screen.findByRole('button', { name: 'Open the rebase agent' });
    expect(h.state.selectAgent).not.toHaveBeenCalled();

    fireEvent.click(action);

    expect(h.state.selectAgent).toHaveBeenCalledWith(SESSION_ID, 'agent-1');
    expect(h.state.setActiveLens).toHaveBeenCalledWith(SESSION_ID, 'agents');
  });

  it('confirms a finished push without leaving the current view', async () => {
    renderActions();
    openMenu();
    await waitFor(() =>
      expect(
        (screen.getByRole('menuitem', { name: 'Push branch' }) as HTMLButtonElement).disabled,
      ).toBe(false),
    );

    fireEvent.click(screen.getByRole('menuitem', { name: 'Push branch' }));

    expect(await screen.findByText('Push started')).toBeDefined();
    expect(await screen.findByText('Push done')).toBeDefined();
    expect(h.state.pushSessionBranch).toHaveBeenCalledWith(SESSION_ID);
    expect(h.state.selectAgent).not.toHaveBeenCalled();
  });
});
