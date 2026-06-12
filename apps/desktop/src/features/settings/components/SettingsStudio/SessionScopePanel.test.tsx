// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

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

vi.mock('../../../../features/chat/utils/chat-constants', () => ({
  PROVIDER_LABEL: { anthropic: 'Claude', cursor: 'Cursor', codex: 'Codex', gemini: 'Gemini' },
}));

vi.mock('../../../../features/providers/components/provider-brand', () => ({
  PROVIDER_BRAND: {
    anthropic: { icon: () => null },
    cursor: { icon: () => null },
    codex: { icon: () => null },
    gemini: { icon: () => null },
  },
  brandColor: () => '#000000',
}));

import { SessionScopePanel } from './SessionScopePanel';

beforeEach(() => {
  state.sessionBranches = { 'sess-1': 'feat/x' };
  state.sessionBudgets = {};
  state.sessionSummary = null;
  state.session.providerPreference = { defaultProvider: 'anthropic' };
  state.providers = [];
  state.loadSessionBudget = vi.fn(async () => undefined);
  state.setSessionConfig = vi.fn(async () => undefined);
  toastMock.mockReset();
});
afterEach(cleanup);

describe('SessionScopePanel', () => {
  it('shows the current branch with a change affordance', () => {
    render(<SessionScopePanel sessionId={'sess-1' as never} />);
    expect(screen.getByText('feat/x')).toBeDefined();
    expect(screen.getByRole('button', { name: /change/i })).toBeDefined();
  });

  it('sets the default provider from a brand chip', () => {
    render(<SessionScopePanel sessionId={'sess-1' as never} />);
    fireEvent.click(screen.getByRole('button', { name: /cursor/i }));
    expect(state.setSessionConfig).toHaveBeenCalledWith('sess-1', { defaultProvider: 'cursor' });
  });

  it('shows an empty routing pool note when nothing is connected', () => {
    render(<SessionScopePanel sessionId={'sess-1' as never} />);
    expect(screen.getByText(/no providers connected/i)).toBeDefined();
  });

  it('toggles a connected provider out of the routing pool', () => {
    state.providers = [
      { id: 'anthropic', connection: 'connected' },
      { id: 'cursor', connection: 'connected' },
    ];
    render(<SessionScopePanel sessionId={'sess-1' as never} />);
    const cursorChips = screen.getAllByRole('button', { name: /cursor/i });
    fireEvent.click(cursorChips[cursorChips.length - 1]!);
    expect(state.setSessionConfig).toHaveBeenCalledWith('sess-1', {
      enabledProviders: ['anthropic'],
    });
  });

  it('does not render archive or delete actions', () => {
    render(<SessionScopePanel sessionId={'sess-1' as never} />);
    expect(screen.queryByRole('button', { name: /^archive$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^delete$/i })).toBeNull();
  });
});
