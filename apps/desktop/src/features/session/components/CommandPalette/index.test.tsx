// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const { state, hooks, toastMock } = vi.hoisted(() => ({
  state: {
    skills: {} as Record<string, ReadonlyArray<unknown>>,
    phaseTemplates: {} as Record<string, ReadonlyArray<unknown>>,
    projectScripts: {} as Record<string, ReadonlyArray<unknown>>,
    sessionPhaseRuns: {} as Record<string, ReadonlyArray<unknown>>,
    sessionWorktrees: {} as Record<string, ReadonlyArray<string>>,
    agentKindOverride: {} as Record<string, string>,
    openWorkspace: vi.fn(async () => undefined),
    setCurrentSession: vi.fn(async () => undefined),
    selectAgent: vi.fn(async () => undefined),
    setActiveLens: vi.fn(),
    runScript: vi.fn(async () => ({ exitCode: 0 })),
  },
  hooks: { currentSession: null as { readonly id: string } | null },
  toastMock: vi.fn(),
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [] as readonly never[],
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
  useWorkspaces: () => [],
  useSessions: () => [],
  useCurrentWorkspace: () => null,
  useCurrentSession: () => hooks.currentSession,
}));

vi.mock('../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast: toastMock }),
}));

import { CommandPalette } from './index';
import { REPORT_ISSUE_STUDIO_EVENT } from '../../../settings/reportIssueStudioEvent';

beforeEach(() => {
  state.skills = {};
  state.phaseTemplates = {};
  state.projectScripts = {};
  state.sessionPhaseRuns = {};
  state.sessionWorktrees = {};
  state.agentKindOverride = {};
  state.setActiveLens.mockReset();
  hooks.currentSession = null;
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

  it('opens the report issue studio through the shared studio event', () => {
    const listener = vi.fn();
    window.addEventListener(REPORT_ISSUE_STUDIO_EVENT, listener);
    render(<CommandPalette onClose={vi.fn()} initialQuery="report an issue" />);

    fireEvent.mouseDown(screen.getByText('Report an issue'));

    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener(REPORT_ISSUE_STUDIO_EVENT, listener);
  });

  it.each([
    ['Open context', 'context'],
    ['Open context: Goal', 'goal'],
    ['Open context: Decisions', 'decisions'],
    ['Open context: Session summary', 'last_output_summary'],
  ] as const)('routes %s to the shared Context surface', (label, lens) => {
    hooks.currentSession = { id: 'session-1' };
    render(<CommandPalette onClose={vi.fn()} initialQuery={label} />);

    fireEvent.mouseDown(screen.getByText(label));

    expect(state.setActiveLens).toHaveBeenCalledWith('session-1', lens);
  });
});
