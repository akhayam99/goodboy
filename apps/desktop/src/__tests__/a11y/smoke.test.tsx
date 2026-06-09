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
      providers: [],
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
      workspaceSummary: null,
      providerSpendBreakdown: [],
      loadBudgetAlerts: vi.fn(),
      dismissBudgetAlert: vi.fn(),
      loadNotifications: vi.fn(),
      markNotificationsRead: vi.fn(),
      clearNotifications: vi.fn(),
      refreshProviders: vi.fn(),
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

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { WorkspaceId } from '@goodboy/types';
import { runA11yCheck } from './utils';
import { NotificationCenter } from '../../features/notifications/components/NotificationCenter';
import { BootSplash } from '../../app/components/BootSplash';
import { SettingsDialog } from '../../features/settings/components/SettingsDialog';
import { WorkspacesSidebar } from '../../features/workspace/components/WorkspacesSidebar';
import { StatusBar } from '../../app/components/StatusBar';
import { SkillsPanel } from '../../features/skills/components/SkillsPanel';
import { QuickActionsPopover } from '../../features/quick-actions';
import { ToastProvider } from '../../app/components/Toast';

afterEach(cleanup);

const WS_ID = 'ws-test' as WorkspaceId;

describe('a11y smoke, NotificationCenter', () => {
  it('no violations (empty state)', async () => {
    const { container } = render(<NotificationCenter />);
    const { violations } = await runA11yCheck(container);
    expect(violations).toHaveLength(0);
  });
});

describe('a11y smoke, Toast / ToastProvider', () => {
  it('no violations (empty toast stack)', async () => {
    const { container } = render(
      <ToastProvider>
        <div />
      </ToastProvider>,
    );
    const { violations } = await runA11yCheck(container);
    expect(violations).toHaveLength(0);
  });
});

describe('a11y smoke, BootSplash', () => {
  it('no violations (loading phase)', async () => {
    const { container } = render(<BootSplash phase="loading-settings" error={null} />);
    const { violations } = await runA11yCheck(container);
    expect(violations).toHaveLength(0);
  });

  it('no violations (boot error)', async () => {
    const { container } = render(<BootSplash phase="error" error="failed to connect" />);
    const { violations } = await runA11yCheck(container);
    expect(violations).toHaveLength(0);
  });
});

describe('a11y smoke, WorkspacesSidebar', () => {
  it('no violations (no workspace selected)', async () => {
    const { container } = render(
      <WorkspacesSidebar
        onOpenSettings={vi.fn()}
        onOpenPalette={vi.fn()}
        onOpenWorkflows={vi.fn()}
        onOpenLinear={vi.fn()}
        onOpenProviders={vi.fn()}
        onOpenGithub={vi.fn()}
        onOpenBudget={vi.fn()}
        onToggleCollapse={vi.fn()}
      />,
    );
    const { violations } = await runA11yCheck(container);
    expect(violations).toHaveLength(0);
  });
});

describe('a11y smoke, StatusBar', () => {
  it('no violations (idle, no session)', async () => {
    const { container } = render(
      <ToastProvider>
        <StatusBar />
      </ToastProvider>,
    );
    const { violations } = await runA11yCheck(container);
    expect(violations).toHaveLength(0);
  });
});

describe('a11y smoke, SkillsPanel', () => {
  it('no violations (no skills)', async () => {
    const { container } = render(<SkillsPanel workspaceId={WS_ID} />);
    const { violations } = await runA11yCheck(container);
    expect(violations).toHaveLength(0);
  });
});

describe('a11y smoke, QuickActionsPopover', () => {
  it('no violations (empty items)', async () => {
    const { container } = render(
      <QuickActionsPopover
        items={[]}
        emptyHint="no scripts"
        onSelect={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    const { violations } = await runA11yCheck(container);
    expect(violations).toHaveLength(0);
  });
});

describe('a11y smoke, SettingsDialog', () => {
  const KNOWN_VIOLATIONS = ['label'];

  it('no new violations beyond whitelisted (dialog open)', async () => {
    const { container } = render(<SettingsDialog open={true} onClose={vi.fn()} />);
    const { violations } = await runA11yCheck(container);
    const unexpected = violations.filter((v) => !KNOWN_VIOLATIONS.includes(v.id));
    expect(unexpected).toHaveLength(0);
  });
});
