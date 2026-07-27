// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ProviderId, SessionId, WorkspaceId, WorkspaceKind } from '@goodboy/types';

type Store = {
  readonly spawnAgent: ReturnType<typeof vi.fn>;
  readonly providers: ReadonlyArray<{ readonly id: ProviderId; readonly connection: string }>;
};

const h = vi.hoisted(() => ({
  spawnAgent: vi.fn(async () => 'a1'),
  providers: [{ id: 'anthropic' as ProviderId, connection: 'connected' }],
  workspaceKind: 'repo' as WorkspaceKind,
}));

vi.mock('../../../../../store', () => ({
  useAppStore: <T,>(selector: (state: Store) => T) =>
    selector({
      spawnAgent: h.spawnAgent,
      providers: h.providers,
    }),
  useCurrentWorkspace: () => ({ id: 'workspace-1' as WorkspaceId, kind: h.workspaceKind }),
}));

import { SpawnAgentControl } from './SpawnAgentControl';

const SID = 'sess-1' as SessionId;

const renderControl = () => {
  render(<SpawnAgentControl sessionId={SID} onSpawned={vi.fn()} />);
};

const selectRole = (role: string) => {
  fireEvent.change(screen.getByRole('combobox', { name: 'agent role' }), {
    target: { value: role },
  });
};

const createAgent = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Create agent' }));
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  h.workspaceKind = 'repo';
});

describe('SpawnAgentControl', () => {
  it('groups the action and quiet configuration controls in one bordered row', () => {
    renderControl();
    const create = screen.getByRole('button', { name: 'Create agent' });
    const role = screen.getByRole('combobox', { name: 'agent role' });
    const routing = screen.getByRole('button', { name: /^new agent routing:/ });
    const row = create.parentElement;

    expect(row?.className).toContain('border-dashed');
    expect(role.closest('.border-dashed')).toBe(row);
    expect(routing.closest('.border-dashed')).toBe(row);
    expect(create.className).not.toContain('border-dashed');
  });

  it('spawns a generic agent with untouched defaults', () => {
    renderControl();
    createAgent();
    expect(h.spawnAgent).toHaveBeenCalledWith(SID, { kindOverride: 'generic' });
  });

  it('hides the role select and spawns generic in a simple workspace', () => {
    h.workspaceKind = 'simple';
    renderControl();

    expect(screen.queryByRole('combobox', { name: 'agent role' })).toBeNull();
    createAgent();
    expect(h.spawnAgent).toHaveBeenCalledWith(SID, { kindOverride: 'generic' });
  });

  it('spawns the selected role', () => {
    renderControl();
    selectRole('docs');
    createAgent();
    expect(h.spawnAgent).toHaveBeenCalledWith(SID, { kindOverride: 'docs' });
  });

  it('passes a pinned model, provider and effort to the spawn', () => {
    renderControl();
    fireEvent.click(screen.getByRole('button', { name: /^new agent routing:/ }));
    fireEvent.click(screen.getByTitle(/^claude-opus-5 \(/));
    createAgent();
    expect(h.spawnAgent).toHaveBeenCalledWith(SID, {
      kindOverride: 'generic',
      provider: 'anthropic',
      model: 'claude-opus-5',
      effort: 'low',
    });
  });

  it('does not spawn when the role changes', () => {
    renderControl();
    selectRole('docs');
    expect(h.spawnAgent).not.toHaveBeenCalled();
  });

  it('resets the role after a successful spawn', async () => {
    renderControl();
    selectRole('docs');
    createAgent();
    await waitFor(() => {
      expect(screen.getByRole<HTMLSelectElement>('combobox', { name: 'agent role' }).value).toBe(
        'generic',
      );
    });
  });
});
