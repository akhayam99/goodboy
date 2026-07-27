// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (state: Store) => T) =>
    selector({
      spawnAgent: h.spawnAgent,
      providers: h.providers,
    }),
  useCurrentWorkspace: () => ({ id: 'workspace-1' as WorkspaceId, kind: h.workspaceKind }),
}));

import { CreateAgentPopover } from './index';

const SID = 'sess-1' as SessionId;

const renderControl = (variant?: 'tile' | 'compact') => {
  render(<CreateAgentPopover sessionId={SID} variant={variant} onSpawned={vi.fn()} />);
};

const openPopover = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Create agent' }));
};

const confirm = () => {
  fireEvent.click(screen.getByRole('button', { name: /^Spawn / }));
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  h.workspaceKind = 'repo';
});

describe('CreateAgentPopover', () => {
  it('replaces the multi-control row with one tile that opens a single popover', () => {
    renderControl();
    const trigger = screen.getByRole('button', { name: 'Create agent' });

    expect(trigger.className).toContain('rounded-lg');
    expect(trigger.className).toContain('border-border-soft');
    expect(trigger.className).toContain('px-3');
    expect(trigger.className).toContain('py-2.5');
    expect(screen.queryByRole('dialog', { name: 'create agent' })).toBeNull();

    openPopover();
    expect(screen.getByRole('dialog', { name: 'create agent' })).toBeTruthy();
  });

  it('offers every visible kind with its hint and spawns the picked one', () => {
    renderControl();
    openPopover();

    const scout = screen.getByRole('button', { name: /^Scout / });
    expect(scout.getAttribute('title')).toBe('Reads and searches codebase. Never edits files');
    expect(scout.textContent).toContain('Reads and searches codebase');

    fireEvent.click(screen.getByRole('button', { name: /^Docs / }));
    confirm();

    expect(h.spawnAgent).toHaveBeenCalledWith(SID, { kindOverride: 'docs' });
  });

  it('spawns a generic agent with untouched defaults', () => {
    renderControl();
    openPopover();
    confirm();

    expect(h.spawnAgent).toHaveBeenCalledWith(SID, { kindOverride: 'generic' });
  });

  it('drops the type section entirely in a simple workspace', () => {
    h.workspaceKind = 'simple';
    renderControl();
    openPopover();

    expect(screen.queryByText('Agent type')).toBeNull();
    confirm();
    expect(h.spawnAgent).toHaveBeenCalledWith(SID, { kindOverride: 'generic' });
  });

  it('passes a pinned model, provider and effort to the spawn', () => {
    renderControl();
    openPopover();
    fireEvent.click(screen.getByTitle(/^claude-opus-5 \(/));
    confirm();

    expect(h.spawnAgent).toHaveBeenCalledWith(SID, {
      kindOverride: 'generic',
      provider: 'anthropic',
      model: 'claude-opus-5',
      effort: 'low',
    });
  });

  it('renders a compact header control without its own edge inset', () => {
    renderControl('compact');
    const trigger = screen.getByRole('button', { name: 'Create agent' });

    expect(trigger.className).toContain('h-7');
    expect(trigger.parentElement?.className).not.toContain('pl-2');
  });
});
