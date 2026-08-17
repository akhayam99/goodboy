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
  readonly providerConnect: Readonly<Record<string, unknown>>;
  readonly connectProvider: ReturnType<typeof vi.fn>;
  readonly cancelProviderConnect: ReturnType<typeof vi.fn>;
  readonly dismissProviderConnect: ReturnType<typeof vi.fn>;
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
  providerConnect: {
    codex: {
      phase: 'idle',
      step: null,
      runId: null,
      command: null,
      authUrl: null,
      identity: null,
      errorTail: null,
      startedAt: null,
    },
  },
  connectProvider: vi.fn(async () => undefined),
  cancelProviderConnect: vi.fn(async () => undefined),
  dismissProviderConnect: vi.fn(() => undefined),
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (state: Store) => T) =>
    selector({
      spawnAgent: h.spawnAgent,
      providers: h.providers,
      sessions: h.sessions as ReadonlyArray<Session>,
      workspaceOverrides: {},
      providerConnect: h.providerConnect,
      connectProvider: h.connectProvider,
      cancelProviderConnect: h.cancelProviderConnect,
      dismissProviderConnect: h.dismissProviderConnect,
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
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 });
});

h.sessions = [makeSession()];

describe('CreateAgentPopover', () => {
  it('replaces the multi-control row with one tile that opens a single popover', () => {
    renderControl();
    const trigger = screen.getByRole('button', { name: 'Create agent' });

    expect(trigger.className).toContain('rounded-lg');
    expect(screen.queryByRole('dialog', { name: 'Create agent' })).toBeNull();

    openPopover();
    const dialog = screen.getByRole('dialog', { name: 'Create agent' });
    expect(dialog).toBeTruthy();
    expect(dialog.closest('[data-dropdown-portal]')?.parentElement).toBe(document.body);
    expect(dialog.className).toContain('fixed');
  });

  it('shows only the selected kind description and spawns the picked one', () => {
    renderControl();
    openPopover();

    const scout = screen.getByRole('button', { name: 'Scout' });
    expect(
      screen.getByText('Plans, investigates, edits, and verifies without a narrow role'),
    ).toBeTruthy();
    expect(screen.queryByText('Reads and searches codebase. Never edits files')).toBeNull();
    expect(scout.parentElement?.className).toContain('grid-cols-3');

    fireEvent.click(screen.getByRole('button', { name: 'Docs' }));
    expect(screen.getByText('Writes documentation. No production logic')).toBeTruthy();
    expect(
      screen.queryByText('Plans, investigates, edits, and verifies without a narrow role'),
    ).toBeNull();
    confirm();

    expect(h.spawnAgent).toHaveBeenCalledWith(SID, {
      kindOverride: 'docs',
      provider: 'anthropic',
      model: 'haiku-4.5',
      effort: 'low',
      focus: 'agent',
    });
  });

  it('gives a generic agent the model the chat is on without a summary row', () => {
    h.sessions = [
      makeSession({
        providerOverride: 'anthropic',
        modelOverride: 'claude-opus-5',
        effort: 'high',
      }),
    ];
    renderControl();
    openPopover();

    expect(screen.queryByText('Claude · Opus 5, high effort')).toBeNull();

    confirm();
    expect(h.spawnAgent).toHaveBeenCalledWith(SID, {
      kindOverride: 'generic',
      provider: 'anthropic',
      model: 'claude-opus-5',
      effort: 'high',
      focus: 'agent',
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
    fireEvent.click(screen.getByRole('button', { name: 'Scout' }));

    expect(screen.getByRole('button', { name: 'Haiku' }).getAttribute('aria-pressed')).toBe('true');

    confirm();
    expect(h.spawnAgent).toHaveBeenCalledWith(SID, {
      kindOverride: 'scout',
      provider: 'anthropic',
      model: 'haiku-4.5',
      effort: 'low',
      focus: 'agent',
    });
  });

  it('selects a model family and version as separate ladder levels', () => {
    renderControl();
    openPopover();
    fireEvent.click(screen.getByRole('button', { name: 'Opus' }));
    fireEvent.click(screen.getByRole('button', { name: '5' }));
    expect(screen.getByRole('button', { name: 'Opus' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: '5' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('spawns exactly the pinned model the picker shows', () => {
    renderControl();
    openPopover();
    fireEvent.click(screen.getByRole('button', { name: 'Opus' }));
    fireEvent.click(screen.getByRole('button', { name: '5' }));

    confirm();
    expect(h.spawnAgent).toHaveBeenCalledWith(SID, {
      kindOverride: 'generic',
      provider: 'anthropic',
      model: 'claude-opus-5',
      effort: 'low',
      focus: 'agent',
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
      focus: 'agent',
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

  it('does not offer a disconnected provider', () => {
    h.providers = [
      { id: 'anthropic' as ProviderId, connection: 'connected' },
      { id: 'codex' as ProviderId, connection: 'missing' },
    ];
    renderControl();
    openPopover();
    expect(screen.getByRole('button', { name: 'Claude' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Codex' })).toBeNull();
  });

  it('links an empty provider state to the in-app Providers surface', () => {
    h.providers = [];
    renderControl();
    openPopover();
    const openProviders = screen.getByRole('button', { name: 'Open providers' });
    const onOpenProviderStudio = vi.fn();
    window.addEventListener('goodboy:open-provider-studio', onOpenProviderStudio);
    fireEvent.click(openProviders);
    window.removeEventListener('goodboy:open-provider-studio', onOpenProviderStudio);
    expect(onOpenProviderStudio).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog', { name: 'Create agent' })).toBeNull();
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
      focus: 'agent',
    });
  });

  it('renders a compact header control without its own edge inset', () => {
    renderControl('compact');
    const trigger = screen.getByRole('button', { name: 'Create agent' });

    expect(trigger.className).toContain('h-7');
    expect(trigger.parentElement?.className).not.toContain('pl-2');
  });

  it('keeps the spawn action in the fixed footer at a short window height', () => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 220 });
    renderControl();
    openPopover();
    const action = screen.getByRole('button', { name: 'Spawn Generalist' });
    const footer = action.closest('footer');
    expect(footer?.className).toContain('shrink-0');
    expect(footer?.previousElementSibling?.getAttribute('role')).toBe('separator');
  });
});
