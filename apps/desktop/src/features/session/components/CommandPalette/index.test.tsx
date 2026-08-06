// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const { state, toastMock } = vi.hoisted(() => ({
  state: {
    skills: {} as Record<string, ReadonlyArray<unknown>>,
    phaseTemplates: {} as Record<string, ReadonlyArray<unknown>>,
    workspaceScripts: {} as Record<string, ReadonlyArray<unknown>>,
    sessionPhaseRuns: {} as Record<string, ReadonlyArray<unknown>>,
    sessionWorktrees: {} as Record<string, ReadonlyArray<string>>,
    agentKindOverride: {} as Record<string, string>,
    openWorkspace: vi.fn(async () => undefined),
    setCurrentSession: vi.fn(async () => undefined),
    selectAgent: vi.fn(async () => undefined),
    runScript: vi.fn(async () => ({ exitCode: 0 })),
  },
  toastMock: vi.fn(),
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [] as readonly never[],
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
  useWorkspaces: () => [],
  useSessions: () => [],
  useCurrentWorkspace: () => null,
  useCurrentSession: () => null,
}));

vi.mock('../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast: toastMock }),
}));

import { CommandPalette } from './index';

beforeEach(() => {
  state.skills = {};
  state.phaseTemplates = {};
  state.workspaceScripts = {};
  state.sessionPhaseRuns = {};
  state.sessionWorktrees = {};
  state.agentKindOverride = {};
  toastMock.mockReset();
});
afterEach(cleanup);

describe('CommandPalette', () => {
  it('renders the search input with the default placeholder', () => {
    render(<CommandPalette onClose={vi.fn()} />);
    expect(screen.getByLabelText(/command palette search/i)).toBeDefined();
  });

  it('shows the no-results row when nothing matches the query', () => {
    render(<CommandPalette onClose={vi.fn()} initialQuery="zzzz" />);
    expect(screen.getByText(/no results/i)).toBeDefined();
  });

  it('routes to the provider studio, the one mandatory first-run action', () => {
    const onOpenProviders = vi.fn();
    render(
      <CommandPalette
        onClose={vi.fn()}
        onOpenProviders={onOpenProviders}
        initialQuery="provider"
      />,
    );

    fireEvent.mouseDown(screen.getByText('Connect a provider'));

    expect(onOpenProviders).toHaveBeenCalledOnce();
  });
});
