// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type {
  IsoDateTime,
  ProviderId,
  Session,
  SessionId,
  WorkspaceId,
  WorkspaceKind,
} from '@goodboy/types';

type Store = {
  readonly spawnAgent: ReturnType<typeof vi.fn>;
  readonly providers: ReadonlyArray<{ readonly id: ProviderId; readonly connection: string }>;
  readonly sessions: ReadonlyArray<Session>;
  readonly workspaceOverrides: Record<string, unknown>;
};

const NOW = '2026-07-27T00:00:00.000Z' as IsoDateTime;
const SID = 'sess-1' as SessionId;

const makeSession = (overrides: Partial<Session> = {}): Session => ({
  id: SID,
  workspaceId: 'workspace-1' as WorkspaceId,
  goal: 'g',
  state: { kind: 'idle', lastActivityAt: NOW },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
  permissionMode: 'default',
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: false,
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
});

const h = vi.hoisted(() => ({
  spawnAgent: vi.fn(async () => 'a1'),
  providers: [{ id: 'anthropic' as ProviderId, connection: 'connected' }],
  workspaceKind: 'repo' as WorkspaceKind,
  sessions: [] as ReadonlyArray<unknown>,
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (state: Store) => T) =>
    selector({
      spawnAgent: h.spawnAgent,
      providers: h.providers,
      sessions: h.sessions as ReadonlyArray<Session>,
      workspaceOverrides: {},
    }),
  useCurrentWorkspace: () => ({ id: 'workspace-1' as WorkspaceId, kind: h.workspaceKind }),
}));

import { CreateAgentPopover } from './index';

const renderControl = (variant?: 'tile' | 'compact') => {
  return render(<CreateAgentPopover sessionId={SID} variant={variant} onSpawned={vi.fn()} />);
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
  h.providers = [{ id: 'anthropic' as ProviderId, connection: 'connected' }];
  h.workspaceKind = 'repo';
  h.sessions = [makeSession()];
});

h.sessions = [makeSession()];

describe('CreateAgentPopover', () => {
  it('replaces the multi-control row with one tile that opens a single popover', () => {
    renderControl();
    const trigger = screen.getByRole('button', { name: 'Create agent' });

    expect(trigger.className).toContain('rounded-lg');
    expect(screen.queryByRole('dialog', { name: 'create agent' })).toBeNull();

    openPopover();
    const dialog = screen.getByRole('dialog', { name: 'create agent' });
    expect(dialog).toBeTruthy();
    expect(dialog.parentElement).toBe(document.body);
    expect(dialog.className).toContain('fixed');
  });

  it('offers every visible kind with its hint and spawns the picked one', () => {
    renderControl();
    openPopover();

    const scout = screen.getByRole('button', { name: /^Scout / });
    expect(scout.getAttribute('title')).toBe('Reads and searches codebase. Never edits files');
    expect(scout.parentElement?.className).toContain('grid-cols-3');

    fireEvent.click(screen.getByRole('button', { name: /^Docs / }));
    confirm();

    expect(h.spawnAgent).toHaveBeenCalledWith(SID, {
      kindOverride: 'docs',
      provider: 'anthropic',
      model: 'haiku-4.5',
      effort: 'low',
    });
  });

  it('gives a generic agent the model the chat is on and says where it comes from', () => {
    h.sessions = [
      makeSession({
        providerOverride: 'anthropic',
        modelOverride: 'claude-opus-5',
        effort: 'high',
      }),
    ];
    renderControl();
    openPopover();

    expect(screen.getByText('Claude · Opus 5, high effort')).toBeTruthy();
    expect(screen.getByText('from this chat')).toBeTruthy();

    confirm();
    expect(h.spawnAgent).toHaveBeenCalledWith(SID, {
      kindOverride: 'generic',
      provider: 'anthropic',
      model: 'claude-opus-5',
      effort: 'high',
    });
  });

  it('keeps a scout on its smaller model even when the chat is on opus', () => {
    h.sessions = [
      makeSession({
        providerOverride: 'anthropic',
        modelOverride: 'claude-opus-5',
        effort: 'high',
      }),
    ];
    renderControl();
    openPopover();
    fireEvent.click(screen.getByRole('button', { name: /^Scout / }));

    expect(screen.getByText('Claude · Haiku 4.5')).toBeTruthy();
    expect(screen.getByText('recommended')).toBeTruthy();
    expect(screen.getByText('Scouts default to a smaller model, they only read code')).toBeTruthy();

    confirm();
    expect(h.spawnAgent).toHaveBeenCalledWith(SID, {
      kindOverride: 'scout',
      provider: 'anthropic',
      model: 'haiku-4.5',
      effort: 'low',
    });
  });

  it('swaps the tag for a reset that names the model it would go back to', () => {
    renderControl();
    openPopover();
    fireEvent.click(screen.getByRole('button', { name: 'Opus 5' }));

    expect(screen.queryByText('recommended')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Use recommended: Haiku 4.5' }));

    expect(screen.getByText('Claude · Haiku 4.5')).toBeTruthy();
    expect(screen.getByText('recommended')).toBeTruthy();
  });

  it('spawns exactly the pinned model the picker shows', () => {
    renderControl();
    openPopover();
    fireEvent.click(screen.getByRole('button', { name: 'Opus 5' }));

    expect(screen.getByText('Claude · Opus 5, low effort')).toBeTruthy();

    confirm();
    expect(h.spawnAgent).toHaveBeenCalledWith(SID, {
      kindOverride: 'generic',
      provider: 'anthropic',
      model: 'claude-opus-5',
      effort: 'low',
    });
  });

  it('renders codex variants as chips without a native select', () => {
    h.providers = [
      { id: 'anthropic' as ProviderId, connection: 'connected' },
      { id: 'codex' as ProviderId, connection: 'connected' },
    ];
    h.sessions = [
      makeSession({
        providerOverride: 'codex',
        modelOverride: 'gpt-5.6',
        effort: 'high',
      }),
    ];
    const { container } = renderControl();
    openPopover();

    expect(container.querySelector('select')).toBeNull();
    expect(screen.getByRole('button', { name: 'Sol' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Terra' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Luna' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Terra' }));
    confirm();
    expect(h.spawnAgent).toHaveBeenCalledWith(SID, {
      kindOverride: 'generic',
      provider: 'codex',
      model: 'gpt-5.6-terra',
      effort: 'high',
    });
  });

  it('announces the same Cursor effort clamp as the routing picker', () => {
    h.providers = [{ id: 'cursor' as ProviderId, connection: 'connected' }];
    h.sessions = [
      makeSession({
        providerOverride: 'cursor',
        modelOverride: 'claude-opus-5-low',
        effort: 'low',
      }),
    ];
    renderControl();
    openPopover();

    fireEvent.click(screen.getByRole('button', { name: 'Thinking' }));

    expect(screen.getByText('Effort adjusted from Low to High.')).toBeTruthy();
  });

  it('drops the type section entirely in a simple workspace', () => {
    h.workspaceKind = 'simple';
    renderControl();
    openPopover();

    expect(screen.queryByText('Agent type')).toBeNull();
    confirm();
    expect(h.spawnAgent).toHaveBeenCalledWith(SID, {
      kindOverride: 'generic',
      provider: 'anthropic',
      model: 'haiku-4.5',
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
