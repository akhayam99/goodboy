// @vitest-environment happy-dom

import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import type { Workspace, WorkspaceId } from '@goodboy/types';

vi.mock('../../../store', async () => {
  const { create } = await import('zustand');
  type MockState = {
    readonly currentWorkspaceId: string | null;
    readonly currentSessionId: string | null;
    readonly activeLens: Readonly<Record<string, string | null>>;
    readonly selectedAgentId: Readonly<Record<string, string | null>>;
    readonly setSessionStudio: () => void;
    readonly setFocusedPlanId: () => void;
    readonly openDiffLens: () => void;
    readonly setCurrentWorkspace: (id: string) => Promise<void>;
    readonly setCurrentSession: (id: string | null) => Promise<void>;
    readonly setActiveLens: (sessionId: string, lens: string | null) => void;
    readonly selectAgent: (sessionId: string, agentId: string) => Promise<void>;
  };
  const useAppStore = create<MockState>((set) => ({
    currentWorkspaceId: 'ws-1',
    currentSessionId: null,
    activeLens: {},
    selectedAgentId: {},
    setSessionStudio: () => undefined,
    setFocusedPlanId: () => undefined,
    openDiffLens: () => undefined,
    setCurrentWorkspace: async (id) => set({ currentWorkspaceId: id }),
    setCurrentSession: async (id) => set({ currentSessionId: id }),
    setActiveLens: (sessionId, lens) =>
      set((state) => ({ activeLens: { ...state.activeLens, [sessionId]: lens } })),
    selectAgent: async (sessionId, agentId) =>
      set((state) => ({ selectedAgentId: { ...state.selectedAgentId, [sessionId]: agentId } })),
  }));
  return { useAppStore, useSessionById: () => null };
});

vi.mock('../../../store/slices/worktrees/resolveSessionRepo', () => ({
  resolveSessionRepo: () => null,
}));
vi.mock('../../../shared/hooks/useCommitLinkInterceptor', () => ({
  useCommitLinkInterceptor: () => ({ commitDiff: null, setCommitDiff: () => undefined }),
}));
vi.mock('../../../features/onboarding/onboarding-store', () => ({ markStepComplete: vi.fn() }));
vi.mock('../../../features/onboarding/OnboardingWizard', () => ({ OnboardingWizard: () => null }));
vi.mock('../../../features/github/github', () => ({ ghCommitDiff: vi.fn() }));
vi.mock('../../../features/worktree/worktree', () => ({ worktreeDiffCommit: vi.fn() }));
vi.mock('../../../features/session/components/CommandPalette', () => ({
  CommandPalette: () => <div data-testid="studio" data-kind="palette" />,
}));
vi.mock('../../../features/session/components/DeleteSessionConfirm', () => ({
  DeleteSessionConfirm: () => null,
}));
vi.mock('../../../features/workspace/components/ConvertWorkspaceDialog', () => ({
  ConvertWorkspaceDialog: () => null,
}));
vi.mock('../../../features/workspace/components/WorkspaceLauncher', () => ({
  WorkspaceLauncher: () => null,
}));
vi.mock('../../../features/permissions/components/DiffViewerDialog', () => ({
  DiffViewerDialog: () => null,
}));
vi.mock('../../../features/settings/components/SettingsStudio', () => ({
  SettingsStudio: ({ focus }: { focus: { scope: string; section?: string } }) => (
    <div
      data-testid="studio"
      data-kind="settings"
      data-scope={focus.scope}
      data-section={focus.section ?? ''}
    />
  ),
}));
vi.mock('../../../features/settings/components/GuideStudio', () => ({
  GuideStudio: () => <div data-testid="studio" data-kind="guide" />,
}));
vi.mock('../../../features/settings/components/ReportIssueStudio', () => ({
  ReportIssueStudio: () => <div data-testid="studio" data-kind="report" />,
}));
vi.mock('../../../features/workspace/components/WorkspaceLinkStudio', () => ({
  WorkspaceLinkStudio: () => <div data-testid="studio" data-kind="addWorkspace" />,
}));
vi.mock('../../../features/workflows/components/WorkflowStudio', () => ({
  WorkflowStudio: () => <div data-testid="studio" data-kind="workflow" />,
}));
vi.mock('../../../features/inbox/components/InboxStudio', () => ({
  InboxStudio: ({ initialProvider }: { initialProvider: string | null }) => (
    <div data-testid="studio" data-kind="inbox" data-provider={initialProvider ?? ''} />
  ),
}));
vi.mock('../../../features/impact/components/ImpactStudio', () => ({
  ImpactStudio: () => <div data-testid="studio" data-kind="impact" />,
}));
vi.mock('../../../features/changelog/components/ChangelogStudio', () => ({
  ChangelogStudio: () => <div data-testid="studio" data-kind="changelog" />,
}));
vi.mock('../../../features/notifications/components/NotificationsStudio', () => ({
  NotificationsStudio: () => <div data-testid="studio" data-kind="notifications" />,
}));
vi.mock('../../../features/companion/components/CompanionStudio', () => ({
  CompanionStudio: () => <div data-testid="studio" data-kind="companion" />,
}));

import { useAppStore } from '../../../store';
import { useAppOverlays } from './index';

type Overlays = ReturnType<typeof useAppOverlays>;

const WORKSPACE_ID = 'ws-1' as WorkspaceId;

const WORKSPACE = { id: WORKSPACE_ID, name: 'Northwind' } as unknown as Workspace;

const handle: { current: Overlays | null } = { current: null };

const Harness = ({ connectedGithub }: { readonly connectedGithub: boolean }) => {
  const overlays = useAppOverlays({
    connected: {
      github: connectedGithub,
      linear: false,
      sentry: false,
      jira: false,
      gitlab: false,
      bitbucket: false,
      slack: false,
    },
    currentSession: null,
    currentWorkspace: WORKSPACE,
    workspaceProjectRoot: '/repo',
    isSessionSidebarCollapsed: false,
    isWorkspaceLauncherBranch: false,
    pinSessionSidebar: () => undefined,
  });
  useEffect(() => {
    handle.current = overlays;
  });
  return <>{overlays.overlays}</>;
};

const overlays = (): Overlays => {
  if (handle.current === null) {
    throw new Error('harness not mounted');
  }
  return handle.current;
};

const renderHarness = ({ connectedGithub = false }: { readonly connectedGithub?: boolean } = {}) =>
  render(<Harness connectedGithub={connectedGithub} />);

const openStudios = async (): Promise<ReadonlyArray<string>> => {
  await act(async () => undefined);
  return screen.queryAllByTestId('studio').map((node) => node.getAttribute('data-kind') ?? '');
};

const fire = ({ name, detail }: { readonly name: string; readonly detail?: unknown }) =>
  act(() => {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  });

beforeEach(() => {
  useAppStore.setState({ currentWorkspaceId: WORKSPACE_ID, currentSessionId: null });
});

afterEach(() => {
  cleanup();
  handle.current = null;
});

describe('app overlay hook', () => {
  it('mounts settings from the open-settings event with the requested scope', async () => {
    renderHarness();

    fire({ name: 'goodboy:open-settings', detail: { scope: 'providers' } });

    expect(await openStudios()).toEqual(['settings']);
    expect(screen.getByTestId('studio').getAttribute('data-scope')).toBe('providers');
  });

  it('mounts the inbox focused on the provider the event names', async () => {
    renderHarness();

    fire({ name: 'goodboy:open-inbox', detail: { provider: 'linear' } });

    expect(await openStudios()).toEqual(['inbox']);
    expect(screen.getByTestId('studio').getAttribute('data-provider')).toBe('linear');
  });

  it('replaces the open studio when a footer opener runs', async () => {
    renderHarness();

    act(() => overlays().openSettings());
    expect(await openStudios()).toEqual(['settings']);

    act(() => overlays().openWorkflows());
    expect(await openStudios()).toEqual(['workflow']);
  });

  it('opens the inbox on github when github is connected and lights its glyph', async () => {
    renderHarness({ connectedGithub: true });

    act(() => overlays().openIntegration({ provider: 'github' }));

    expect(await openStudios()).toEqual(['inbox']);
    expect(screen.getByTestId('studio').getAttribute('data-provider')).toBe('github');
    expect(overlays().footer).toBe('github');
  });

  it('opens the tools form for a disconnected integration and lights the link action', async () => {
    renderHarness();

    act(() => overlays().openIntegration({ provider: 'github' }));

    expect(await openStudios()).toEqual(['settings']);
    expect(screen.getByTestId('studio').getAttribute('data-scope')).toBe('tools');
    expect(overlays().footer).toBe('link');
  });

  it('leaves only settings when the shortcut help opens over another studio', async () => {
    renderHarness();

    act(() => overlays().openInbox());
    act(() => overlays().openShortcutHelp());

    expect(await openStudios()).toEqual(['settings']);
    expect(screen.getByTestId('studio').getAttribute('data-section')).toBe('shortcuts');
  });

  it('leaves only the companion when pairing opens over workflows', async () => {
    renderHarness();

    act(() => overlays().openWorkflows());
    fire({ name: 'goodboy:open-pair-device' });

    expect(await openStudios()).toEqual(['companion']);
  });

  it('leaves nothing open after settings, then pairing, then close', async () => {
    renderHarness();

    act(() => overlays().openSettings());
    fire({ name: 'goodboy:open-pair-device' });
    expect(await openStudios()).toEqual(['companion']);

    fire({ name: 'goodboy:reveal-chat' });

    expect(await openStudios()).toEqual([]);
  });
});
