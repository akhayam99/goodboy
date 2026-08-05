// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const { state, toastMock } = vi.hoisted(() => ({
  state: {
    loadSetting: vi.fn(async () => null),
    saveSetting: vi.fn(async () => undefined),
    deleteWorkspace: vi.fn(async () => undefined),
    workspaceOverrides: {} as Record<string, unknown>,
    setWorkspaceOverrides: vi.fn(async () => undefined),
    workspaceIntegrations: {} as Record<string, ReadonlyArray<unknown>>,
    providers: [] as ReadonlyArray<{ id: string; connection: string }>,
    orphanWorktrees: {} as Record<
      string,
      ReadonlyArray<{ path: string; name: string; sizeBytes: number }>
    >,
    removeOrphanWorktrees: vi.fn(async () => undefined),
  },
  toastMock: vi.fn(),
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

vi.mock('../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast: toastMock }),
}));

vi.mock('../../../../features/skills/components/SkillsPanel', () => ({
  SkillsPanel: () => null,
}));

vi.mock('../../../../features/session/components/VerbositySelect', () => ({
  VerbositySelect: () => null,
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

beforeEach(() => {
  state.loadSetting = vi.fn(async () => null);
  state.saveSetting = vi.fn(async () => undefined);
  state.deleteWorkspace = vi.fn(async () => undefined);
  state.workspaceOverrides = {};
  state.setWorkspaceOverrides = vi.fn(async () => undefined);
  state.workspaceIntegrations = {};
  state.providers = [];
  state.orphanWorktrees = {};
  state.removeOrphanWorktrees = vi.fn(async () => undefined);
  toastMock.mockReset();
});
afterEach(cleanup);

import { WorkspaceScopePanel } from './WorkspaceScopePanel';

describe('WorkspaceScopePanel', () => {
  it('renders the one-page fields without a nav rail', () => {
    render(<WorkspaceScopePanel workspaceId={'ws-1' as never} requestClose={vi.fn()} />);
    expect(screen.getByLabelText(/branch prefix/i)).toBeDefined();
    expect(screen.queryByText(/default provider/i)).toBeNull();
    expect(screen.getByText(/parallel agents/i)).toBeDefined();
    expect(screen.queryByText('Linear')).toBeNull();
    expect(screen.queryByText('GitHub')).toBeNull();
    expect(screen.queryByRole('button', { name: /^general$/i })).toBeNull();
  });

  it('shows the disconnect action with inline confirm', () => {
    render(<WorkspaceScopePanel workspaceId={'ws-1' as never} requestClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /disconnect/i }));
    expect(screen.getByRole('button', { name: /confirm/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDefined();
  });

  it('hides the leftover folders section when there is nothing to clean', () => {
    render(<WorkspaceScopePanel workspaceId={'ws-1' as never} requestClose={vi.fn()} />);
    expect(screen.queryByText(/session folders left on disk/i)).toBeNull();
  });

  it('asks twice before deleting the folders it found', () => {
    state.orphanWorktrees = {
      'ws-1': [{ path: '/repo/.goodboy/worktrees/gb-ghost', name: 'gb-ghost', sizeBytes: 2048 }],
    };
    render(<WorkspaceScopePanel workspaceId={'ws-1' as never} requestClose={vi.fn()} />);

    expect(screen.getByText('gb-ghost')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /delete 1 folders \(2 kb\)/i }));

    expect(state.removeOrphanWorktrees).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    expect(state.removeOrphanWorktrees).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      paths: ['/repo/.goodboy/worktrees/gb-ghost'],
    });
  });
});
