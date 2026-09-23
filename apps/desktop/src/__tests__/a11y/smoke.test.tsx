// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));
vi.mock('@tauri-apps/plugin-shell', () => ({ Command: { create: vi.fn() } }));
vi.mock('@tauri-apps/plugin-sql', () => ({
  default: { load: vi.fn().mockResolvedValue({}) },
}));

const storeSeed = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock('../../store', () => {
  const buildState = () => ({
    notifications: [],
    skills: {},
    budgetAlerts: [],
    providers: [],
    settings: {},
    phaseTemplates: {},
    sessionBudgets: {},
    sessionWorktrees: {},
    sessionTelemetry: {},
    sessionSummary: null,
    sessions: [],
    detectedEditors: [],
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
    githubStatus: null,
    refreshGithubStatus: vi.fn(),
    setGithubPat: vi.fn(),
    clearGithubToken: vi.fn(),
    reconcileOrphanWorktrees: vi.fn(async () => undefined),
    loadDetectedEditors: vi.fn(async () => undefined),
    ...storeSeed.current,
  });
  return {
    useAppStore: Object.assign(
      vi.fn((selector: (s: unknown) => unknown) => selector(buildState())),
      { getState: buildState },
    ),
    useCurrentSession: vi.fn().mockReturnValue(null),
    useCurrentWorkspace: vi.fn().mockReturnValue(null),
    useWorkspaces: vi.fn().mockReturnValue([]),
    useSessions: vi.fn().mockReturnValue([]),
    useSessionSlots: vi.fn().mockReturnValue([]),
    EMPTY_ARRAY: [] as never[],
  };
});

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

import { afterEach, describe, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { Notification } from '@goodboy/db';
import type { IsoDateTime, Skill, SkillId, WorkspaceId } from '@goodboy/types';
import { expectBaseline } from './baseline';
import { NotificationCenter } from '../../features/notifications/components/NotificationCenter';
import { BootSplash } from '../../app/components/BootSplash';
import { AppScopePanel } from '../../features/settings/components/SettingsStudio/AppScopePanel';
import { SkillsPanel } from '../../features/skills/components/SkillsPanel';
import { QuickActionsPopover, type QuickActionItem } from '../../features/quick-actions';
import { ToastProvider } from '../../app/components/Toast';

afterEach(() => {
  cleanup();
  storeSeed.current = {};
});

const WS_ID = 'ws-test' as WorkspaceId;
const AT = '2026-09-01T09:00:00.000Z' as IsoDateTime;

const NOTIFICATIONS: ReadonlyArray<Notification> = [
  {
    id: 'notification-1',
    ts: AT,
    kind: 'session-created',
    title: 'Session created in Harborline',
    body: 'ledger-core is mounted and ready.',
    severity: 'info',
    sessionId: null,
    workspaceId: WS_ID,
    read: false,
    action: null,
    coalesceKey: null,
  },
  {
    id: 'notification-2',
    ts: AT,
    kind: 'pr-created',
    title: 'Pull request opened on payments-api',
    body: null,
    severity: 'success',
    sessionId: null,
    workspaceId: WS_ID,
    read: true,
    action: null,
    coalesceKey: null,
  },
];

const buildSkill = ({ id, name }: { id: string; name: string }): Skill => ({
  id: id as SkillId,
  workspaceId: WS_ID,
  name,
  description: `${name} for the Northwind services`,
  filePath: `.claude/skills/${name}/SKILL.md`,
  body: 'Steps.',
  frontmatter: { name, description: `${name} for the Northwind services` },
  createdAt: AT,
  updatedAt: AT,
});

const SKILLS: ReadonlyArray<Skill> = [
  buildSkill({ id: 'skill-1', name: 'release-notes' }),
  buildSkill({ id: 'skill-2', name: 'migration-review' }),
];

const QUICK_ACTIONS: ReadonlyArray<QuickActionItem> = [
  { id: 'qa-1', label: 'test', sublabel: 'pnpm test', group: 'script', perform: vi.fn() },
  { id: 'qa-2', label: 'lint', sublabel: 'pnpm lint', group: 'script', perform: vi.fn() },
  { id: 'qa-3', label: 'build', sublabel: 'pnpm build', group: 'script', perform: vi.fn() },
];

const renderInToasts = (node: React.ReactNode) => render(<ToastProvider>{node}</ToastProvider>);

describe('a11y smoke, NotificationCenter', () => {
  it('empty state', async () => {
    const { container } = render(<NotificationCenter />);
    await expectBaseline({ name: 'NotificationCenter empty', container });
  });

  it('two notifications, one unread', async () => {
    storeSeed.current = { notifications: NOTIFICATIONS };
    const { container } = render(<NotificationCenter />);
    await expectBaseline({ name: 'NotificationCenter populated', container });
  });
});

describe('a11y smoke, Toast / ToastProvider', () => {
  it('empty toast stack', async () => {
    const { container } = renderInToasts(<div />);
    await expectBaseline({ name: 'ToastProvider empty', container });
  });
});

describe('a11y smoke, BootSplash', () => {
  it('loading phase', async () => {
    const { container } = render(<BootSplash phase="loading-settings" error={null} />);
    await expectBaseline({ name: 'BootSplash loading', container });
  });

  it('boot error', async () => {
    const { container } = render(<BootSplash phase="error" error="failed to connect" />);
    await expectBaseline({ name: 'BootSplash error', container });
  });
});

describe('a11y smoke, SkillsPanel', () => {
  it('no skills', async () => {
    const { container } = renderInToasts(<SkillsPanel workspaceId={WS_ID} />);
    await expectBaseline({ name: 'SkillsPanel empty', container });
  });

  it('two skills', async () => {
    storeSeed.current = { skills: { [WS_ID]: SKILLS } };
    const { container } = renderInToasts(<SkillsPanel workspaceId={WS_ID} />);
    await expectBaseline({ name: 'SkillsPanel populated', container });
  });
});

describe('a11y smoke, QuickActionsPopover', () => {
  it('empty items', async () => {
    const { container } = render(
      <QuickActionsPopover
        items={[]}
        emptyHint="no scripts"
        onSelect={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    await expectBaseline({ name: 'QuickActionsPopover empty', container });
  });

  it('three items', async () => {
    const { container } = render(
      <QuickActionsPopover
        items={QUICK_ACTIONS}
        emptyHint="no scripts"
        onSelect={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    await expectBaseline({ name: 'QuickActionsPopover populated', container });
  });
});

describe('a11y smoke, SettingsStudio app scope', () => {
  it('panel open', async () => {
    const { container } = renderInToasts(<AppScopePanel requestClose={vi.fn()} />);
    await expectBaseline({ name: 'AppScopePanel open', container });
  });
});
