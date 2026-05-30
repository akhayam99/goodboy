// @vitest-environment happy-dom
// Snapshot baseline for empty + error states.
// Purpose: catch unintentional regressions during pre-0.1.0 IA refactor.
// Update snapshots intentionally with: vitest run --update-snapshots

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
      sessionTelemetry: {},
      sessionSummary: null,
      sessions: [],
      sessionPhaseRuns: {},
      sessionPlans: {},
      workspaces: [],
      loadBudgetAlerts: vi.fn(),
      dismissBudgetAlert: vi.fn(),
      loadNotifications: vi.fn(),
      markNotificationsRead: vi.fn(),
      clearNotifications: vi.fn(),
      refreshProviders: vi.fn(),
      installProvider: vi.fn(),
      loginProvider: vi.fn(),
      logoutProvider: vi.fn(),
      cancelProviderLifecycle: vi.fn(),
      loadSkills: vi.fn(),
      saveSkill: vi.fn(),
      deleteSkill: vi.fn(),
      rescanSkills: vi.fn(),
      createSession: vi.fn(),
      loadSetting: vi.fn().mockResolvedValue(null),
      saveSetting: vi.fn(),
      setSessionBudget: vi.fn(),
      loadSessionBudget: vi.fn(),
      setCurrentWorkspace: vi.fn(),
      setCurrentSession: vi.fn(),
      addWorkspace: vi.fn(),
      endSession: vi.fn(),
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
import type { ProviderInfo } from '../../features/providers/providers';
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
    selector({ providerLifecycle: DEFAULT_LIFECYCLE_MAP, ...partial } as AppStore),
  );
}
import { NotificationCenter } from '../../features/notifications/components/NotificationCenter';
import { BootSplash } from '../../app/components/BootSplash';
import { NewSessionDialog } from '../../features/session/components/NewSessionDialog';
import { EndSessionDialog } from '../../features/session/components/EndSessionDialog';
import { SkillsPanel } from '../../features/skills/components/SkillsPanel';
import { QuickActionsPopover } from '../../features/quick-actions';
import { WorkspacesSidebar } from '../../features/workspace/components/WorkspacesSidebar';
import { BudgetRulesPanel } from '../../features/budget/components/BudgetRulesPanel';
import { ProvidersPanel } from '../../features/providers/components/ProvidersPanel';
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

function makeProviderInfo(overrides: Partial<ProviderInfo> = {}): ProviderInfo {
  return {
    id: 'anthropic',
    binary: 'claude',
    label: 'claude',
    docsUrl: 'https://docs.claude.com',
    error: null,
    connection: 'connected',
    version: '1.0.0',
    identity: null,
    capabilities: {
      models: [],
      supportsTools: true,
      supportsStream: true,
      supportsCheapModel: false,
    },
    ...overrides,
  };
}

describe('snapshot, empty states', () => {
  it('SkillsPanel: no skills', () => {
    const { container } = render(<SkillsPanel workspaceId={WS_ID} />);
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
    const { container } = render(
      <WorkspacesSidebar
        onOpenSettings={vi.fn()}
        onOpenPalette={vi.fn()}
        onOpenWorkflows={vi.fn()}
        onToggleCollapse={vi.fn()}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('NewSessionDialog: no workflows', () => {
    const { container } = render(
      <ToastProvider>
        <NewSessionDialog
          open={true}
          onClose={vi.fn()}
          workspaceId={WS_ID}
          onOpenSettings={vi.fn()}
        />
      </ToastProvider>,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('ProvidersPanel: no providers (store returns [])', () => {
    const { container } = render(<ProvidersPanel />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('NotificationCenter: no notifications', () => {
    const { container } = render(<NotificationCenter />);
    expect(container.firstChild).toMatchSnapshot();
  });
});

describe('snapshot, error states', () => {
  it('App init error, BootSplash with error message', () => {
    const { container } = render(<BootSplash phase="error" error="database migration failed" />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('NewSessionDialog: form error', () => {
    mockStore({
      providers: [],
      skills: {},
      settings: {},
      phaseTemplates: {},
      sessionBudgets: {},
      workspaces: [],
      loadSetting: vi.fn().mockResolvedValue(null),
      createSession: vi.fn().mockRejectedValue(new Error('workspace git repo not found')),
      setSessionBudget: vi.fn(),
    });
    const { container } = render(
      <ToastProvider>
        <NewSessionDialog
          open={true}
          onClose={vi.fn()}
          workspaceId={WS_ID}
          onOpenSettings={vi.fn()}
        />
      </ToastProvider>,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('EndSessionDialog: error state', () => {
    mockStore({
      endSession: vi.fn().mockRejectedValue(new Error('session already ended')),
    });
    const { container } = render(
      <EndSessionDialog session={makeSession()} open={true} onClose={vi.fn()} />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('BootSplash: boot-error phase', () => {
    const { container } = render(<BootSplash phase="error" error="detecting-cli failed" />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('ProvidersPanel: provider in error state', () => {
    mockStore({
      providers: [makeProviderInfo({ connection: 'error', error: 'unknown error' })],
      refreshProviders: vi.fn(),
    });
    const { container } = render(<ProvidersPanel />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('BudgetRulesPanel: form error', () => {
    mockStore({
      budgetRules: [],
      loadBudgetRules: vi.fn(),
      saveBudgetRule: vi.fn().mockRejectedValue(new Error('cap must be positive')),
      deleteBudgetRule: vi.fn(),
    });
    const { container } = render(<BudgetRulesPanel />);
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
