// @vitest-environment happy-dom
// Tests for ContextPanel rail variant (collapsed state) — #318.

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));
vi.mock('@tauri-apps/plugin-shell', () => ({ Command: { create: vi.fn() } }));
vi.mock('@tauri-apps/plugin-sql', () => ({
  default: { load: vi.fn().mockResolvedValue({}) },
}));

vi.mock('../store', () => ({
  EMPTY_ARRAY: [],
  useAppStore: vi.fn((selector: (s: unknown) => unknown) => {
    const state = {
      upsertSessionSlot: vi.fn(),
      toggleSessionSlot: vi.fn(),
      summarizerStatus: {},
      sessionTelemetry: {},
      sessionWorktrees: {},
      settings: {},
      githubStatus: null,
      sessionBranches: {},
      sessionGithub: {},
      sessions: [],
      workspaces: [],
      refreshSessionPr: vi.fn(),
      refreshSessionPrDetail: vi.fn(),
      createPrForSession: vi.fn(),
      spawnAgent: vi.fn(),
      clearSessionNextActions: vi.fn(),
      loadDiffComments: vi.fn(),
    };
    return selector(state);
  }),
  useSessionSlots: vi.fn().mockReturnValue([]),
  useSummarizerStatus: vi
    .fn()
    .mockReturnValue({ status: 'idle', lastUpdate: null, error: null, lastUsage: null }),
  useSlotHistory: vi.fn().mockReturnValue([]),
  useSessionNextActions: vi.fn().mockReturnValue([]),
  useDiffComments: vi.fn().mockReturnValue([]),
  useFilesTouched: vi.fn().mockReturnValue({ paths: [], count: 0 }),
}));

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Task, TaskId, WorkspaceId } from '@kay-am/types';
import { ContextPanel } from '../components/ContextPanel';

afterEach(cleanup);

const WS_ID = 'ws-test' as WorkspaceId;

function makeSession(overrides: Partial<Task> = {}): Task {
  return {
    id: 'sess-1' as TaskId,
    workspaceId: WS_ID,
    goal: 'test goal',
    branchPrefix: 'test',
    createdAt: '2026-01-01T00:00:00.000Z' as never,
    state: { kind: 'idle' },
    providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
    ...overrides,
  } as Task;
}

describe('snapshot — ContextPanel variants', () => {
  it('collapsed: renders rail button, not slot content', () => {
    const { container } = render(
      <ContextPanel session={makeSession()} collapsed={true} onExpand={vi.fn()} />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('expanded: renders slot content, not rail button', () => {
    const { container } = render(
      <ContextPanel session={makeSession()} collapsed={false} onCollapse={vi.fn()} />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});

describe('ContextPanel rail — a11y attributes', () => {
  it('has role=button', () => {
    render(<ContextPanel session={makeSession()} collapsed={true} onExpand={vi.fn()} />);
    expect(screen.getByRole('button', { name: /expand context panel/i })).toBeDefined();
  });

  it('has aria-label="expand context panel"', () => {
    render(<ContextPanel session={makeSession()} collapsed={true} onExpand={vi.fn()} />);
    const rail = screen.getByRole('button', { name: /expand context panel/i });
    expect(rail.getAttribute('aria-label')).toBe('expand context panel');
  });

  it('is focusable (native button)', () => {
    render(<ContextPanel session={makeSession()} collapsed={true} onExpand={vi.fn()} />);
    const rail = screen.getByRole('button', { name: /expand context panel/i });
    rail.focus();
    expect(document.activeElement).toBe(rail);
  });
});

describe('ContextPanel rail — keyboard', () => {
  it('Enter key calls onExpand', async () => {
    const onExpand = vi.fn();
    render(<ContextPanel session={makeSession()} collapsed={true} onExpand={onExpand} />);
    const rail = screen.getByRole('button', { name: /expand context panel/i });
    rail.focus();
    fireEvent.keyDown(rail, { key: 'Enter' });
    expect(onExpand).toHaveBeenCalledOnce();
  });

  it('Space key calls onExpand', async () => {
    const onExpand = vi.fn();
    render(<ContextPanel session={makeSession()} collapsed={true} onExpand={onExpand} />);
    const rail = screen.getByRole('button', { name: /expand context panel/i });
    rail.focus();
    fireEvent.keyDown(rail, { key: ' ' });
    expect(onExpand).toHaveBeenCalledOnce();
  });

  it('click calls onExpand', async () => {
    const user = userEvent.setup();
    const onExpand = vi.fn();
    render(<ContextPanel session={makeSession()} collapsed={true} onExpand={onExpand} />);
    const rail = screen.getByRole('button', { name: /expand context panel/i });
    await user.click(rail);
    expect(onExpand).toHaveBeenCalledOnce();
  });
});

describe('ContextPanel — persistence contract', () => {
  it('collapsed=false: rail button present in DOM but visually hidden', () => {
    render(<ContextPanel session={makeSession()} collapsed={false} onCollapse={vi.fn()} />);
    const rail = screen.getByRole('button', { name: /expand context panel/i });
    expect(rail.closest('.hidden')).not.toBeNull();
  });

  it('collapsed=true: context header present in DOM but visually hidden', () => {
    render(<ContextPanel session={makeSession()} collapsed={true} onExpand={vi.fn()} />);
    const scrollArea = document.querySelector('.h-full.hidden');
    expect(scrollArea).not.toBeNull();
  });
});
