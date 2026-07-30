// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session, WorktreeStatus } from '@goodboy/types';

type PushResult = { ok: true } | { ok: false; error: string };

const { fixtures, mocks, state } = vi.hoisted(() => ({
  fixtures: {
    status: {
      ahead: 0,
      commitsBehindMain: 0,
    } as WorktreeStatus,
  },
  mocks: {
    openInEditor: vi.fn(async () => undefined),
    showToast: vi.fn(),
    worktreeStatus: vi.fn(),
  },
  state: {
    sessionWorktrees: { 'session-1': ['/tmp/worktree'] },
    sessionBranches: { 'session-1': 'ak/feat-shortcuts' },
    sessionGithub: {},
    workspaces: [{ id: 'workspace-1', kind: 'repo' }],
    sessionPhaseRuns: {} as Record<string, ReadonlyArray<{ name: string; status: string }>>,
    settings: {},
    detectedEditors: [{ binary: 'cursor', label: 'Cursor' }],
    loadDetectedEditors: vi.fn(async () => undefined),
    sessions: [
      {
        id: 'session-1',
        workspaceId: 'workspace-1',
        providerPreference: { defaultProvider: 'anthropic' },
      },
    ],
    workspaceOverrides: {},
    spawnAgent: vi.fn(async () => 'agent-1'),
    selectAgent: vi.fn(async () => undefined),
    pushSessionBranch: vi.fn(async (): Promise<PushResult> => ({ ok: true })),
  },
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T,>(selector: (store: typeof state) => T) => selector(state),
}));

vi.mock('../../../worktree/worktree', () => ({
  worktreeStatus: mocks.worktreeStatus,
}));

vi.mock('../../../../shared/lib/editor', () => ({
  openInEditor: mocks.openInEditor,
}));

vi.mock('../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));

vi.mock('../../components/AgentSpawnConfig/taskModelAgentSpawnConfig', () => ({
  taskModelAgentSpawnConfig: () => ({
    provider: 'codex',
    model: 'gpt-5.4',
    effort: 'low',
  }),
}));

import { SessionShortcuts } from './SessionShortcuts';

const session = {
  id: 'session-1',
  workspaceId: 'workspace-1',
  workflowRuns: [],
  providerPreference: { defaultProvider: 'anthropic' },
} as unknown as Session;

const renderShortcuts = () => render(<SessionShortcuts session={session} />);

beforeEach(() => {
  fixtures.status = {
    ahead: 0,
    commitsBehindMain: 0,
  } as WorktreeStatus;
  mocks.worktreeStatus.mockReset();
  mocks.worktreeStatus.mockImplementation(async () => fixtures.status);
  mocks.openInEditor.mockClear();
  mocks.showToast.mockClear();
  state.sessionWorktrees = { 'session-1': ['/tmp/worktree'] };
  state.sessionBranches = { 'session-1': 'ak/feat-shortcuts' };
  state.sessionGithub = {};
  state.workspaces = [{ id: 'workspace-1', kind: 'repo' }];
  state.sessionPhaseRuns = {};
  state.settings = {};
  state.detectedEditors = [{ binary: 'cursor', label: 'Cursor' }];
  state.loadDetectedEditors.mockClear();
  state.spawnAgent.mockReset();
  state.spawnAgent.mockResolvedValue('agent-1');
  state.selectAgent.mockReset();
  state.selectAgent.mockResolvedValue(undefined);
  state.pushSessionBranch.mockReset();
  state.pushSessionBranch.mockResolvedValue({ ok: true });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('SessionShortcuts', () => {
  it('shows rebase only while the branch is behind main', async () => {
    fixtures.status = { ...fixtures.status, commitsBehindMain: 2 };
    const { unmount } = renderShortcuts();

    expect(await screen.findByRole('button', { name: 'Rebase on main' })).toBeDefined();
    unmount();
    fixtures.status = { ...fixtures.status, commitsBehindMain: 0 };
    renderShortcuts();
    await waitFor(() => expect(mocks.worktreeStatus).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('button', { name: 'Rebase on main' })).toBeNull();
  });

  it('shows push only for unpushed commits and surfaces push failures', async () => {
    fixtures.status = { ...fixtures.status, ahead: 3 };
    state.pushSessionBranch.mockResolvedValueOnce({
      ok: false,
      error: 'remote rejected the branch',
    });
    renderShortcuts();

    fireEvent.click(await screen.findByRole('button', { name: 'Push branch' }));

    expect((await screen.findByRole('alert')).textContent).toContain('remote rejected the branch');
  });

  it('shows the named rebase agent as busy and guards the action', async () => {
    fixtures.status = { ...fixtures.status, commitsBehindMain: 1 };
    state.sessionPhaseRuns = {
      'session-1': [{ name: 'Rebase on main', status: 'running' }],
    };
    renderShortcuts();

    const button = await screen.findByRole('button', { name: 'Rebasing...' });
    expect(button.hasAttribute('disabled')).toBe(true);
    fireEvent.click(button);
    expect(state.spawnAgent).not.toHaveBeenCalled();
  });

  it('opens PR creation and the detected editor from plain actions', async () => {
    const openPr = vi.fn();
    window.addEventListener('goodboy:open-github-session', openPr);
    renderShortcuts();

    fireEvent.click(await screen.findByRole('button', { name: 'Open PR' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open in editor' }));

    expect(openPr).toHaveBeenCalledOnce();
    await waitFor(() => expect(mocks.openInEditor).toHaveBeenCalledWith('/tmp/worktree', 'cursor'));
    window.removeEventListener('goodboy:open-github-session', openPr);
  });

  it('throttles focus refreshes without polling', async () => {
    vi.useFakeTimers({ now: 100_000 });
    renderShortcuts();
    await act(async () => undefined);
    expect(mocks.worktreeStatus).toHaveBeenCalledOnce();

    fireEvent.focus(window);
    expect(mocks.worktreeStatus).toHaveBeenCalledOnce();

    await act(async () => {
      vi.advanceTimersByTime(10_000);
      fireEvent.focus(window);
    });
    expect(mocks.worktreeStatus).toHaveBeenCalledTimes(2);
  });
});
