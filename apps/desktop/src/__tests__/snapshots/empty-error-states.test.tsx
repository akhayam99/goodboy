// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));
vi.mock('@tauri-apps/plugin-shell', () => ({ Command: { create: vi.fn() } }));
vi.mock('@tauri-apps/plugin-sql', () => ({
  default: { load: vi.fn().mockResolvedValue({}) },
}));

vi.mock('../../store', () => ({
  useAppStore: vi.fn((selector: (s: unknown) => unknown) => {
    const state = {
      budgetAlerts: [],
      notifications: [],
      notificationCounts: { total: 0, unread: 0 },
      providers: [],
      providerLifecycle: {
        anthropic: {
          phase: 'idle' as const,
          runId: null,
          action: null,
          command: null,
          exitCode: null,
          startedAt: null,
          errorTail: null,
          detectedAuthUrl: null,
        },
        cursor: {
          phase: 'idle' as const,
          runId: null,
          action: null,
          command: null,
          exitCode: null,
          startedAt: null,
          errorTail: null,
          detectedAuthUrl: null,
        },
        codex: {
          phase: 'idle' as const,
          runId: null,
          action: null,
          command: null,
          exitCode: null,
          startedAt: null,
          errorTail: null,
          detectedAuthUrl: null,
        },
        gemini: {
          phase: 'idle' as const,
          runId: null,
          action: null,
          command: null,
          exitCode: null,
          startedAt: null,
          errorTail: null,
          detectedAuthUrl: null,
        },
      },
      skills: {},
      settings: {},
      phaseTemplates: {},
      sessionBudgets: {},
      sessionWorktrees: {},
      sessionBranches: {},
      sessionTelemetry: {},
      sessionSummary: null,
      sessions: [],
      sessionPhaseRuns: {},
      sessionPlans: {},
      workspaces: [],
      workspaceIntegrations: {},
      newSessionDrafts: {},
      loadBudgetAlerts: vi.fn(),
      dismissBudgetAlert: vi.fn(),
      loadNotifications: vi.fn(),
      markNotificationsRead: vi.fn(),
      clearNotifications: vi.fn(),
      refreshProviders: vi.fn(),
      logoutProvider: vi.fn(),
      cancelProviderLifecycle: vi.fn(),
      loadSkills: vi.fn(),
      saveSkill: vi.fn(),
      deleteSkill: vi.fn(),
      rescanSkills: vi.fn(),
      createSession: vi.fn(),
      setNewSessionDraft: vi.fn(),
      clearNewSessionDraft: vi.fn(),
      loadSetting: vi.fn().mockResolvedValue(null),
      saveSetting: vi.fn(),
      setSessionBudget: vi.fn(),
      loadSessionBudget: vi.fn(),
      setCurrentWorkspace: vi.fn(),
      setCurrentSession: vi.fn(),
      addWorkspace: vi.fn(),
      deleteTask: vi.fn(),
      archiveTask: vi.fn(),
      sendTurn: vi.fn(),
      cancelCurrentTurn: vi.fn(),
      hydrate: vi.fn(),
      hydrated: true,
      bootPhase: 'ready' as const,
      error: null,
      budgetRules: [],
      loadBudgetRules: vi.fn(),
      saveBudgetRule: vi.fn(),
      deleteBudgetRule: vi.fn(),
    };
    return selector(state);
  }),
  useCurrentSession: vi.fn().mockReturnValue(null),
  useCurrentWorkspace: vi.fn().mockReturnValue(null),
  useWorkspaces: vi.fn().mockReturnValue([]),
  useSessions: vi.fn().mockReturnValue([]),
  useSessionSlots: vi.fn().mockReturnValue([]),
  useHasUnreadElsewhere: vi.fn().mockReturnValue(false),
  EMPTY_ARRAY: [] as never[],
}));

vi.mock('../../features/permissions/permissions', () => ({
  useEffectivePermissionRules: vi.fn().mockReturnValue([]),
  invokePermissionRuleList: vi.fn().mockResolvedValue([]),
  invokePermissionRuleUpsert: vi.fn().mockResolvedValue(undefined),
  invokePermissionRuleDelete: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../shared/lib/editor', () => ({
  openInEditor: vi.fn(),
  openUrl: vi.fn(),
}));

vi.mock('../../routing', () => ({
  resolveProviderForTurn: vi.fn().mockResolvedValue('anthropic'),
}));

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { AppStore } from '../../store/store';
import type { Session, SessionId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../store';

const IDLE_LIFECYCLE = {
  phase: 'idle' as const,
  runId: null,
  action: null,
  command: null,
  exitCode: null,
  startedAt: null,
  errorTail: null,
  detectedAuthUrl: null,
};

const DEFAULT_LIFECYCLE_MAP = {
  anthropic: IDLE_LIFECYCLE,
  cursor: IDLE_LIFECYCLE,
  codex: IDLE_LIFECYCLE,
  gemini: IDLE_LIFECYCLE,
};

function mockStore(partial: Partial<AppStore>): void {
  vi.mocked(useAppStore).mockImplementation((selector: (state: AppStore) => unknown) =>
    selector({
      providerLifecycle: DEFAULT_LIFECYCLE_MAP,
      newSessionDrafts: {},
      workspaces: [],
      sessionBranches: {},
      setNewSessionDraft: vi.fn(),
      clearNewSessionDraft: vi.fn(),
      ...partial,
    } as AppStore),
  );
}
import { NoWorkspaceScreen } from '../../app/components/AppEmptyState';
import { ChatEmptyState } from '../../features/chat/components/ChatView/ChatEmptyState';
import { NotificationCenter } from '../../features/notifications/components/NotificationCenter';
import { BootSplash } from '../../app/components/BootSplash';
import { NewSessionView } from '../../features/session/components/NewSessionView';
import { DeleteSessionConfirm } from '../../features/session/components/DeleteSessionConfirm';
import { SkillsPanel } from '../../features/skills/components/SkillsPanel';
import { QuickActionsPopover } from '../../features/quick-actions';
import { WorkspacesSidebar } from '../../features/workspace/components/WorkspacesSidebar';
import { TranscriptCard } from '../../features/chat/components/TranscriptCards';
import { ToastProvider } from '../../app/components/Toast';

afterEach(cleanup);

const WS_ID = 'ws-test' as WorkspaceId;

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'sess-1' as SessionId,
    workspaceId: WS_ID,
    goal: 'test goal',
    branchPrefix: 'test',
    createdAt: '2026-01-01T00:00:00.000Z' as never,
    state: { kind: 'idle' },
    providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
    ...overrides,
  } as Session;
}

describe('snapshot, empty states', () => {
  it('SkillsPanel: no skills', () => {
    const { container } = render(
      <ToastProvider>
        <SkillsPanel workspaceId={WS_ID} />
      </ToastProvider>,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('QuickActionsPopover: no skills / empty items', () => {
    const { container } = render(
      <QuickActionsPopover
        items={[]}
        emptyHint="no skills. create one in settings"
        onSelect={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('WorkspacesSidebar: no workspace selected', () => {
    const { container } = render(<WorkspacesSidebar />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('NewSessionView: no workflows', () => {
    const { container } = render(
      <ToastProvider>
        <NewSessionView onClose={vi.fn()} workspaceId={WS_ID} onOpenSettings={vi.fn()} />
      </ToastProvider>,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('NotificationCenter: no notifications', () => {
    const { container } = render(<NotificationCenter />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('NoWorkspaceScreen: no workspace, add-workspace CTA', () => {
    const { container, getByRole } = render(<NoWorkspaceScreen onAddWorkspace={vi.fn()} />);
    expect(getByRole('button', { name: /add workspace/i })).toBeTruthy();
    expect(container.firstChild).toMatchSnapshot();
  });

  it('ChatEmptyState: fresh session, set-up-a-workflow CTA', () => {
    const { container, getByRole } = render(
      <ChatEmptyState
        sessionId={'sess-1' as SessionId}
        selectedAgentId={null}
        phaseRuns={[]}
        hasWorkflow={false}
      />,
    );
    const workflowButton = getByRole('button', { name: /set up a workflow/i });
    expect(workflowButton.querySelector('.lucide-waypoints')).toBeTruthy();
    expect(container.firstChild).toMatchSnapshot();
  });
});

describe('snapshot, error states', () => {
  it('App init error, BootSplash with error message', () => {
    const { container } = render(<BootSplash phase="error" error="database migration failed" />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('NewSessionView: form error', () => {
    mockStore({
      providers: [],
      skills: {},
      settings: {},
      phaseTemplates: {},
      sessionBudgets: {},
      workspaces: [],
      workspaceIntegrations: {},
      loadSetting: vi.fn().mockResolvedValue(null),
      createSession: vi.fn().mockRejectedValue(new Error('workspace git repo not found')),
      setSessionBudget: vi.fn(),
    });
    const { container } = render(
      <ToastProvider>
        <NewSessionView onClose={vi.fn()} workspaceId={WS_ID} onOpenSettings={vi.fn()} />
      </ToastProvider>,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('DeleteSessionConfirm: error state', () => {
    mockStore({
      deleteTask: vi.fn().mockRejectedValue(new Error('session not found')),
    });
    const { container } = render(
      <DeleteSessionConfirm session={makeSession()} onClose={vi.fn()} />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('BootSplash: boot-error phase', () => {
    const { container } = render(<BootSplash phase="error" error="detecting-cli failed" />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('TranscriptCard: turn error item', () => {
    const { container } = render(
      <TranscriptCard
        item={{
          kind: 'error',
          key: 'err-1',
          message: 'provider failed to respond',
        }}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});
