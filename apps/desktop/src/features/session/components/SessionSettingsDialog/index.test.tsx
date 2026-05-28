// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

const { state, toastMock } = vi.hoisted(() => ({
  state: {
    session: {
      id: 'sess-1',
      goal: 'do the thing',
      providerPreference: { defaultProvider: 'anthropic' },
      workspaceId: 'ws-1',
    },
    sessionBranches: { 'sess-1': 'feat/x' } as Record<string, string | null>,
    sessionBudgets: {} as Record<string, unknown>,
    sessionSummary: null as null | { estimatedCostUsd: number },
    loadSessionBudget: vi.fn(async () => undefined),
    setSessionBudget: vi.fn(async () => undefined),
    setSessionConfig: vi.fn(async () => undefined),
    renameTask: vi.fn(async () => undefined),
    deleteTask: vi.fn(async () => undefined),
    changeSessionBranch: vi.fn(async () => undefined),
    providers: [] as ReadonlyArray<{ id: string; connection: string }>,
    workspaces: [{ id: 'ws-1', rootPath: '/repo' }] as ReadonlyArray<{
      id: string;
      rootPath: string;
    }>,
  },
  toastMock: vi.fn(),
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
  useSessionById: () => state.session,
}));

vi.mock('../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast: toastMock }),
}));

vi.mock('../../../../features/worktree/worktree', () => ({
  listLocalBranches: vi.fn(async () => []),
}));

vi.mock('../../../../features/worktree/BranchCombobox', () => ({
  BranchCombobox: () => null,
}));

import { SessionSettingsDialog } from './index';

beforeEach(() => {
  state.sessionBranches = { 'sess-1': 'feat/x' };
  state.sessionBudgets = {};
  state.sessionSummary = null;
  state.loadSessionBudget = vi.fn(async () => undefined);
  toastMock.mockReset();
});
afterEach(cleanup);

describe('SessionSettingsDialog', () => {
  it('renders the dialog title and the session goal as description', () => {
    render(
      <SessionSettingsDialog
        sessionId={'sess-1' as never}
        open
        onClose={vi.fn()}
        archived={false}
        onArchive={vi.fn()}
        onUnarchive={vi.fn()}
      />,
    );
    expect(screen.getByText(/session settings/i)).toBeDefined();
    expect(screen.getByText(/do the thing/i)).toBeDefined();
  });

  it('renders the Archive and Delete actions in the footer', () => {
    render(
      <SessionSettingsDialog
        sessionId={'sess-1' as never}
        open
        onClose={vi.fn()}
        archived={false}
        onArchive={vi.fn()}
        onUnarchive={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /^archive$/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /^delete$/i })).toBeDefined();
  });
});
