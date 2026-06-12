// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Session } from '@goodboy/types';

const { state, toastMock } = vi.hoisted(() => ({
  state: {
    sessionWorktrees: {} as Record<string, ReadonlyArray<string>>,
    renameTask: vi.fn(async () => undefined),
    sessionExternalTasks: {} as Record<string, unknown>,
    detectedEditors: [] as ReadonlyArray<{ binary: string; label: string }>,
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

vi.mock('../../../session/components/SessionStageBadge', () => ({
  SessionStageBadge: () => null,
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
  state: { kind: 'idle' },
} as unknown as Session;

beforeEach(() => {
  state.sessionWorktrees = {};
  state.sessionExternalTasks = {};
  state.detectedEditors = [];
  state.sessionBranches = {};
  state.sessionTelemetry = {};
  toastMock.mockReset();
});
afterEach(cleanup);

describe('SessionDetailPanel', () => {
  it('renders the session goal text', () => {
    render(<SessionDetailPanel session={session} onOpenSessionSettings={vi.fn()} />);
    expect(screen.getByText(/refactor auth/i)).toBeDefined();
  });

  it('opens session settings from the gear button', () => {
    const onOpenSessionSettings = vi.fn();
    render(<SessionDetailPanel session={session} onOpenSessionSettings={onOpenSessionSettings} />);
    fireEvent.click(screen.getByRole('button', { name: /session settings/i }));
    expect(onOpenSessionSettings).toHaveBeenCalledOnce();
  });

  it('renders the editor menu trigger', () => {
    render(<SessionDetailPanel session={session} onOpenSessionSettings={vi.fn()} />);
    expect(screen.getByRole('button', { name: /open in editor/i })).toBeDefined();
  });
});
