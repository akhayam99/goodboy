// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../storyHarness';
import type { Notification } from '@goodboy/db';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  PlanId,
  PlanWithCount,
  ProviderRunId,
  Session,
  SessionId,
  Workspace,
  WorkspaceId,
} from '@goodboy/types';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).dbLibModuleMock(),
);
vi.mock('../../../shared/lib/ls-to-db-migration', async () =>
  (await import('../../storyHarness')).lsToDbMigrationModuleMock(),
);
vi.mock('../../../features/onboarding/onboarding-store', async () =>
  (await import('../../storyHarness')).onboardingStoreModuleMock(),
);
vi.mock('../../../features/chat/turn', async () =>
  (await import('../../storyHarness')).turnModuleMock(),
);
vi.mock('../../../features/permissions/permissions', async () =>
  (await import('../../storyHarness')).permissionsModuleMock(),
);
vi.mock('../../../features/providers/providers', async () =>
  (await import('../../storyHarness')).providersModuleMock(),
);
vi.mock('../../../features/providers/routing', async () =>
  (await import('../../storyHarness')).routingModuleMock(),
);
vi.mock('../../../features/budget/budget', async () =>
  (await import('../../storyHarness')).budgetModuleMock(),
);
vi.mock('../../../features/skills/skills', async () =>
  (await import('../../storyHarness')).skillsModuleMock(),
);
vi.mock('../../../features/workflows/workflows', async () =>
  (await import('../../storyHarness')).workflowsModuleMock(),
);
vi.mock('../../../features/worktree/worktree', async () =>
  (await import('../../storyHarness')).worktreeModuleMock(),
);
vi.mock('../../../shared/lib/repo', async () =>
  (await import('../../storyHarness')).repoModuleMock(),
);
vi.mock('../../../shared/lib/editor', async () =>
  (await import('../../storyHarness')).editorModuleMock(),
);
vi.mock('../../../features/plans/plans', async () =>
  (await import('../../storyHarness')).plansModuleMock(),
);
vi.mock('../../../features/integrations/linear/client', async () =>
  (await import('../../storyHarness')).linearClientModuleMock(),
);
vi.mock('../../../features/github/github', async () =>
  (await import('../../storyHarness')).githubModuleMock(),
);
vi.mock('@goodboy/core', async (importOriginal) =>
  (await import('../../storyHarness')).coreModuleMock(importOriginal),
);
vi.mock('../../../features/scripts/scripts', async () =>
  (await import('../../storyHarness')).scriptsModuleMock(),
);
vi.mock('../../../features/terminal/terminal', async () =>
  (await import('../../storyHarness')).terminalModuleMock(),
);
vi.mock('../../../features/context/components/QuestionsTab/useOpenQuestions', async () =>
  (await import('../../storyHarness')).openQuestionsModuleMock(),
);
vi.mock('../../../features/settings/config-export', async () =>
  (await import('../../storyHarness')).configExportModuleMock(),
);

const WS_ID = 'workspace-1' as WorkspaceId;
const WS_ID_2 = 'workspace-2' as WorkspaceId;
const SESSION_ID = 'session-1' as SessionId;
const SESSION_ID_2 = 'session-2' as SessionId;
const AGENT_ID = 'agent-1' as AgentId;
const AGENT_ID_2 = 'agent-2' as AgentId;
const RUN_ID = 'run-1' as ProviderRunId;
const PLAN_ID = 'plan-1' as PlanId;
const NOW = '2026-05-28T00:00:00.000Z' as IsoDateTime;

function buildWorkspace(overrides: Partial<Workspace> = {}): Workspace {
  return {
    id: WS_ID,
    name: 'ws',
    slug: 'ws',
    sessionsRoot: '/tmp/repo',
    overrides: {
      defaultProviderId: null,
      defaultWorkflowId: null,
      defaultBranchPrefix: null,
      parallelEnabled: null,
      defaultVerbosity: null,
      providerBindings: null,
      taskModels: null,
      roleModels: null,
      parallelAgents: null,
      providerPool: null,
      attributionFooter: null,
    },
    createdAt: NOW,
    updatedAt: NOW,
    lastAccessedAt: NOW,
    ...overrides,
  };
}

function buildSession(overrides: Partial<Session> = {}): Session {
  return {
    id: SESSION_ID,
    workspaceId: WS_ID,
    goal: 'do a thing',
    state: { kind: 'idle', lastActivityAt: NOW },
    contextSlots: [],
    providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: false },
    permissionMode: 'bypassPermissions',
    autoRun: false,
    titleUserEdited: false,
    workflowRuns: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function buildAgent(overrides: Partial<Agent> & Pick<Agent, 'id'>): Agent {
  return {
    sessionId: SESSION_ID,
    ordinal: 0,
    name: 'agent 1',
    status: 'pending',
    ...overrides,
  };
}

function buildPlan(overrides: Partial<PlanWithCount> = {}): PlanWithCount {
  return {
    id: PLAN_ID,
    sessionId: SESSION_ID,
    agentId: AGENT_ID,
    title: 't',
    bodyMd: 'b',
    status: 'active',
    consumptionCount: 0,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

describe('store contract', () => {
  beforeEach(async () => {
    await resetStoryStore();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('notifications', () => {
    it('emitNotification prepends a new notification', async () => {
      const store = useAppStore;
      await store.getState().emitNotification({ kind: 'error', severity: 'error', title: 'oops' });
      const ns = store.getState().notifications;
      expect(ns).toHaveLength(1);
      expect(ns[0]?.title).toBe('oops');
      expect(ns[0]?.read).toBe(false);
      expect(ns[0]?.coalesceKey).toBe('error:global:error:oops');
      expect(storySpies.insertNotification).toHaveBeenCalledTimes(1);
    });

    it('emitNotification keys two unrelated failures in one session apart', async () => {
      const store = useAppStore;
      await store.getState().emitNotification({
        kind: 'error',
        severity: 'error',
        title: 'summarizer failed',
        sessionId: SESSION_ID,
      });
      await store.getState().emitNotification({
        kind: 'error',
        severity: 'error',
        title: 'orchestrator failed',
        sessionId: SESSION_ID,
      });
      const keys = store.getState().notifications.map((n) => n.coalesceKey);
      expect(keys).toEqual([
        `error:${SESSION_ID}:error:orchestrator failed`,
        `error:${SESSION_ID}:error:summarizer failed`,
      ]);
    });

    it('emitNotification leaves an explicit coalesceKey untouched', async () => {
      const store = useAppStore;
      await store.getState().emitNotification({
        kind: 'error',
        severity: 'warning',
        title: 'Context near the limit',
        body: 'body',
        sessionId: SESSION_ID,
        coalesceKey: `context-soft-cap:${SESSION_ID}`,
      });
      expect(store.getState().notifications[0]?.coalesceKey).toBe(`context-soft-cap:${SESSION_ID}`);
    });

    it('emitNotification persists action payload to DB', async () => {
      const store = useAppStore;
      await store.getState().emitNotification({
        kind: 'error',
        severity: 'error',
        title: 'summarizer failed',
        body: 'anthropic: timeout',
        sessionId: SESSION_ID,
        action: { kind: 'retry-summarizer', sessionId: SESSION_ID },
      });
      const ns = store.getState().notifications;
      expect(ns[0]?.action).toEqual({ kind: 'retry-summarizer', sessionId: SESSION_ID });
      expect(storySpies.insertNotification).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: { kind: 'retry-summarizer', sessionId: SESSION_ID },
          coalesceKey: `error:${SESSION_ID}:error:summarizer failed`,
        }),
      );
    });

    it('emitNotification keeps the row in memory when the insert fails', async () => {
      const store = useAppStore;
      storySpies.insertNotification.mockRejectedValueOnce(new Error('database is locked'));
      await expect(
        store.getState().emitNotification({ kind: 'error', severity: 'error', title: 'Kept' }),
      ).resolves.toBeUndefined();
      expect(store.getState().notifications[0]?.title).toBe('Kept');
      expect(store.getState().notificationCounts.unread).toBe(1);
    });

    it('reportError persists an error row with the formatted failure as body', async () => {
      const store = useAppStore;
      await store.getState().reportError({
        title: "Couldn't prune transcripts",
        error: new Error('disk full'),
        sessionId: SESSION_ID,
      });
      const row = store.getState().notifications[0];
      expect(row).toMatchObject({
        kind: 'error',
        severity: 'error',
        title: "Couldn't prune transcripts",
        sessionId: SESSION_ID,
      });
      expect(row?.body).toContain('disk full');
      expect(storySpies.insertNotification).toHaveBeenCalledTimes(1);
    });

    it('reportError truncates a long failure and honours a warning severity', async () => {
      const store = useAppStore;
      await store.getState().reportError({
        title: "Couldn't read the log",
        error: 'x'.repeat(2000),
        severity: 'warning',
      });
      const row = store.getState().notifications[0];
      expect(row?.severity).toBe('warning');
      expect(row?.body).toHaveLength(600);
      expect(row?.body?.endsWith('…')).toBe(true);
    });

    it('markNotificationsRead flips read=true on all entries', async () => {
      const store = useAppStore;
      store.setState({
        notifications: [{ id: 'n1', read: false } as never, { id: 'n2', read: false } as never],
      });
      await store.getState().markNotificationsRead();
      expect(store.getState().notifications.every((n) => n.read)).toBe(true);
    });

    it('markNotificationRead flips read=true on that entry alone', async () => {
      const store = useAppStore;
      store.setState({
        notifications: [{ id: 'n1', read: false } as never, { id: 'n2', read: false } as never],
      });
      await store.getState().markNotificationRead('n2');
      const ns = store.getState().notifications;
      expect(ns.find((n) => n.id === 'n1')?.read).toBe(false);
      expect(ns.find((n) => n.id === 'n2')?.read).toBe(true);
      expect(storySpies.markNotificationRead).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'n2' }) as never,
      );
    });

    it('dismissNotification drops that entry alone', async () => {
      const store = useAppStore;
      store.setState({
        notifications: [{ id: 'n1' } as never, { id: 'n2' } as never],
      });
      await store.getState().dismissNotification('n1');
      expect(store.getState().notifications.map((n) => n.id)).toEqual(['n2']);
      expect(storySpies.deleteNotification).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'n1' }) as never,
      );
    });

    it('loadNotifications keeps the counts true when the list is capped', async () => {
      const store = useAppStore;
      const capped = Array.from({ length: 200 }, (_, i) => ({
        id: `n${i}`,
        read: true,
      })) as unknown as ReadonlyArray<Notification>;
      storySpies.listNotifications.mockResolvedValue(capped);
      storySpies.countNotifications.mockResolvedValue({ total: 205, unread: 1 });

      await store.getState().loadNotifications();

      const s = store.getState();
      expect(s.notifications).toHaveLength(200);
      expect(s.notifications.some((n) => !n.read)).toBe(false);
      expect(s.notificationCounts).toEqual({ total: 205, unread: 1 });
    });

    it('markNotificationRead decrements the unread count past the cap', async () => {
      const store = useAppStore;
      store.setState({
        notifications: [{ id: 'n1', read: false } as never],
        notificationCounts: { total: 205, unread: 3 },
      });
      await store.getState().markNotificationRead('n1');
      expect(store.getState().notificationCounts).toEqual({ total: 205, unread: 2 });
    });

    it('dismissNotification decrements both counts past the cap', async () => {
      const store = useAppStore;
      store.setState({
        notifications: [{ id: 'n1', read: false } as never],
        notificationCounts: { total: 205, unread: 3 },
      });
      await store.getState().dismissNotification('n1');
      expect(store.getState().notificationCounts).toEqual({ total: 204, unread: 2 });
    });

    it('markNotificationsRead zeroes unread even for rows past the cap', async () => {
      const store = useAppStore;
      store.setState({
        notifications: [{ id: 'n1', read: false } as never],
        notificationCounts: { total: 205, unread: 7 },
      });
      await store.getState().markNotificationsRead();
      expect(store.getState().notificationCounts).toEqual({ total: 205, unread: 0 });
    });

    it('clearNotifications empties the array', async () => {
      const store = useAppStore;
      store.setState({
        notifications: [{ id: 'n1' } as never],
      });
      await store.getState().clearNotifications();
      expect(store.getState().notifications).toEqual([]);
      expect(store.getState().notificationCounts).toEqual({ total: 0, unread: 0 });
    });
  });
});
