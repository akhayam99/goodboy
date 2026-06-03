// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { Session } from '@goodboy/types';

const { state, toastMock } = vi.hoisted(() => ({
  state: {
    sessionWorktrees: {} as Record<string, ReadonlyArray<string>>,
    setSessionUserStatus: vi.fn(async () => undefined),
    renameTask: vi.fn(async () => undefined),
    sessionExternalTasks: {} as Record<string, unknown>,
    detectedEditors: [] as ReadonlyArray<{ binary: string; label: string }>,
    workspaceScripts: {} as Record<string, ReadonlyArray<unknown>>,
    loadScripts: vi.fn(async () => undefined),
    runWorkspaceScript: vi.fn(async () => undefined),
    sessionBranches: {} as Record<string, string | null>,
    sessionTelemetry: {} as Record<string, ReadonlyArray<unknown>>,
  },
  toastMock: vi.fn(),
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [] as readonly never[],
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

vi.mock('../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast: toastMock }),
}));

vi.mock('../../../session/components/SessionStatusMenu', () => ({
  SessionStatusMenu: () => null,
}));

vi.mock('../../../../shared/components/OverflowMenu', () => ({
  OverflowMenu: ({ label }: { label: string }) => (
    <button type="button" aria-label={label}>
      menu
    </button>
  ),
}));

vi.mock('../../../../shared/lib/editor', () => ({
  openInEditor: vi.fn(async () => undefined),
}));

import { SessionDetailPanel } from './index';

const session: Session = {
  id: 'sess-1',
  workspaceId: 'ws-1',
  goal: 'refactor auth',
  userStatus: 'wip',
  state: { kind: 'idle' },
} as unknown as Session;

beforeEach(() => {
  state.sessionWorktrees = {};
  state.sessionExternalTasks = {};
  state.detectedEditors = [];
  state.workspaceScripts = {};
  state.sessionBranches = {};
  state.sessionTelemetry = {};
  state.loadScripts = vi.fn(async () => undefined);
  toastMock.mockReset();
});
afterEach(cleanup);

describe('SessionDetailPanel', () => {
  it('renders the session goal text', () => {
    render(<SessionDetailPanel session={session} onOpenSessionSettings={vi.fn()} />);
    expect(screen.getByText(/refactor auth/i)).toBeDefined();
  });

  it('loads scripts on mount for this session workspace', () => {
    render(<SessionDetailPanel session={session} onOpenSessionSettings={vi.fn()} />);
    expect(state.loadScripts).toHaveBeenCalledWith('ws-1');
  });

  it('renders the overflow menu trigger', () => {
    render(<SessionDetailPanel session={session} onOpenSessionSettings={vi.fn()} />);
    expect(screen.getByRole('button', { name: /session actions/i })).toBeDefined();
  });
});
