// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Notification, NotificationAction } from '@goodboy/db';
import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type SessionId,
  type WorkflowRunId,
  type WorkspaceId,
} from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  type StoryStore,
} from '../../../../store/storyHarness';

const SESSION_ID = brandId<SessionId>({ value: 'session-1' });
const AGENT_ID = brandId<AgentId>({ value: 'agent-1' });
const RUN_ID = brandId<WorkflowRunId>({ value: 'run-1' });

const openNotificationSessionSpy = vi.hoisted(() => vi.fn(() => true));

vi.mock('../../openNotificationSession', () => ({
  openNotificationSession: openNotificationSessionSpy,
}));

import { mapNotificationAction } from './';

const retrySummarizerSpy = vi.fn();
const retryStepSummarySpy = vi.fn(async () => undefined);
const orchestrateNextStepSpy = vi.fn(async () => undefined);
const retryPublicationSpy = vi.fn(async () => ({
  publicationId: 'pub-1',
  repo: 'acme/web',
  prNumber: 248,
  branch: 'feature/retry',
  localHead: 'abc',
  remoteHead: null,
  requiresPush: false,
  frozenAt: 1,
  commits: [],
  unapproved: [],
  replies: [],
  notes: [],
  excluded: [],
  drift: [],
  blocker: null,
}));
const publishConversationsSpy = vi.fn(async () => ({
  kind: 'done' as const,
  pushed: false,
  pushedHead: null,
  total: 1,
  replies: 1,
  replied: 1,
  closed: 0,
  resolved: 1,
  leftOpen: 0,
  failed: 0,
  error: null,
}));
const navigateSpy = vi.fn();
const emitNotificationSpy = vi.fn(async () => undefined);

type Store = ReturnType<StoryStore['getState']>;

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const buildStore = (overrides: Partial<Store> = {}): Store => {
  useAppStore.setState({
    summarizerStatus: {},
    retrySummarizer: retrySummarizerSpy,
    retryStepSummary: retryStepSummarySpy,
    orchestrateNextStep: orchestrateNextStepSpy,
    retryPublication: retryPublicationSpy,
    publishConversations: publishConversationsSpy,
    navigate: navigateSpy,
    emitNotification: emitNotificationSpy,
    ...overrides,
  });
  return useAppStore.getState();
};

const notificationOf = (action: NotificationAction): Notification => ({
  id: 'n-other-workspace',
  ts: brandId<IsoDateTime>({ value: '2026-11-06T09:00:00.000Z' }),
  kind: 'error',
  title: 'Checks failed',
  body: null,
  severity: 'warning',
  sessionId: SESSION_ID,
  workspaceId: brandId<WorkspaceId>({ value: 'ws-northwind' }),
  read: false,
  action,
  coalesceKey: null,
  actedAt: null,
});

const mapAction = (action: NotificationAction, store: Store) =>
  mapNotificationAction(action, store, notificationOf(action));

describe('mapNotificationAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('open-place: opens the notification through its own workspace, as the bell row does', () => {
    const action: NotificationAction = {
      kind: 'open-place',
      sessionId: SESSION_ID,
      reason: 'ci-failed',
      mountId: null,
    };

    mapAction(action, buildStore())?.onClick();

    expect(openNotificationSessionSpy).toHaveBeenCalledWith({
      notification: notificationOf(action),
    });
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('retry-orchestrator: asks the orchestrator again for that run, past the gate', () => {
    const action: NotificationAction = {
      kind: 'retry-orchestrator',
      sessionId: SESSION_ID,
      workflowRunId: RUN_ID,
    };
    const toastAction = mapAction(action, buildStore());

    expect(toastAction?.label).toBe('Retry');
    toastAction?.onClick();
    expect(orchestrateNextStepSpy).toHaveBeenCalledWith(SESSION_ID, RUN_ID, { bypassGate: true });
  });

  it('retry-summarizer: returns undefined when lastAttempt is missing', () => {
    const action: NotificationAction = { kind: 'retry-summarizer', sessionId: SESSION_ID };
    const store = buildStore({ summarizerStatus: {} });
    const result = mapAction(action, store);
    expect(result).toBeUndefined();
  });

  it('retry-summarizer: returns action with Retry label when lastAttempt exists', () => {
    const lastAttempt = { turnInput: 'user prompt', turnOutput: 'agent reply', workingDir: null };
    const status = { status: 'error', lastUpdate: null, error: null, lastUsage: null } as const;
    const action: NotificationAction = { kind: 'retry-summarizer', sessionId: SESSION_ID };
    const store = buildStore({ summarizerStatus: { [SESSION_ID]: { ...status, lastAttempt } } });
    const toastAction = mapAction(action, store);
    expect(toastAction?.label).toBe('Retry');
  });

  it('retry-summarizer: onClick calls retrySummarizer with sessionId', () => {
    const lastAttempt = { turnInput: 'user prompt', turnOutput: 'agent reply', workingDir: null };
    const status = { status: 'error', lastUpdate: null, error: null, lastUsage: null } as const;
    const action: NotificationAction = { kind: 'retry-summarizer', sessionId: SESSION_ID };
    const store = buildStore({ summarizerStatus: { [SESSION_ID]: { ...status, lastAttempt } } });
    const toastAction = mapAction(action, store);
    toastAction?.onClick();
    expect(retrySummarizerSpy).toHaveBeenCalledWith(SESSION_ID);
  });

  it('retry-step-summary: returns action with Retry label', () => {
    const action: NotificationAction = {
      kind: 'retry-step-summary',
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
    };
    const store = buildStore();
    const toastAction = mapAction(action, store);
    expect(toastAction?.label).toBe('Retry');
  });

  it('retry-step-summary: onClick calls retryStepSummary with correct params', () => {
    const action: NotificationAction = {
      kind: 'retry-step-summary',
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
    };
    const store = buildStore();
    const toastAction = mapAction(action, store);
    toastAction?.onClick();
    expect(retryStepSummarySpy).toHaveBeenCalledWith({ sessionId: SESSION_ID, agentId: AGENT_ID });
  });

  it.each([
    ['ci-failed', 'Open Checks'],
    ['push-failed', 'Open Comments'],
    ['pr-opened', 'Open pull request'],
    ['history-stopped', 'Open branch'],
  ] as const)('open-place: names the place for %s in the button', (reason, label) => {
    const action: NotificationAction = {
      kind: 'open-place',
      sessionId: SESSION_ID,
      reason,
      mountId: null,
    };

    expect(mapAction(action, buildStore())?.label).toBe(label);
  });

  it('open-activity: names the session, not a page that does not exist', () => {
    const action: NotificationAction = { kind: 'open-activity', sessionId: SESSION_ID };

    expect(mapAction(action, buildStore())?.label).toBe('Open session');
  });

  it('open-agent: returns action with Open agent label', () => {
    const action: NotificationAction = {
      kind: 'open-agent',
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
    };
    const store = buildStore();
    const toastAction = mapAction(action, store);
    expect(toastAction?.label).toBe('Open agent');
  });

  it('open-agent: onClick opens the session, selects the agent and reveals the chat', async () => {
    const action: NotificationAction = {
      kind: 'open-agent',
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
    };
    const store = buildStore();
    const revealed = vi.fn();
    window.addEventListener('goodboy:reveal-chat', revealed);

    const toastAction = mapAction(action, store);
    toastAction?.onClick();
    await vi.waitFor(() => expect(revealed).toHaveBeenCalled());

    expect(navigateSpy).toHaveBeenCalledWith({
      to: { at: 'agent', sessionId: SESSION_ID, agentId: AGENT_ID },
    });
    window.removeEventListener('goodboy:reveal-chat', revealed);
  });

  it('retry-publication: returns action with the check and retry label', () => {
    const action: NotificationAction = { kind: 'retry-publication', sessionId: SESSION_ID };
    const store = buildStore();
    const toastAction = mapAction(action, store);
    expect(toastAction?.label).toBe('Check and retry');
  });

  it('retry-publication: onClick reconciles a failed publication and publishes the fresh preview', async () => {
    const action: NotificationAction = { kind: 'retry-publication', sessionId: SESSION_ID };
    const store = buildStore();
    const toastAction = mapAction(action, store);
    toastAction?.onClick();
    await vi.waitFor(() =>
      expect(publishConversationsSpy).toHaveBeenCalledWith({
        sessionId: SESSION_ID,
        publicationId: 'pub-1',
      }),
    );
    expect(retryPublicationSpy).toHaveBeenCalledWith({ sessionId: SESSION_ID, mountId: null });
  });

  it('retry-publication: reports a rejected retry instead of leaving an unhandled rejection', async () => {
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    const action: NotificationAction = { kind: 'retry-publication', sessionId: SESSION_ID };
    const store = buildStore({
      retryPublication: vi.fn(async () => {
        throw new Error('the pull request could not be read');
      }),
    });

    const toastAction = mapAction(action, store);
    toastAction?.onClick();
    await vi.waitFor(() => expect(emitNotificationSpy).toHaveBeenCalled());

    expect(emitNotificationSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'error',
        severity: 'error',
        title: 'Retry failed, the conversations stay open',
        body: expect.stringContaining('the pull request could not be read'),
        sessionId: SESSION_ID,
      }),
    );
    expect(publishConversationsSpy).not.toHaveBeenCalled();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(unhandled).not.toHaveBeenCalled();
    process.off('unhandledRejection', unhandled);
  });

  it('retry-publication: reports a rejected publication', async () => {
    const action: NotificationAction = { kind: 'retry-publication', sessionId: SESSION_ID };
    const store = buildStore({
      publishConversations: vi.fn(async () => {
        throw new Error('github refused the reply');
      }),
    });

    const toastAction = mapAction(action, store);
    toastAction?.onClick();
    await vi.waitFor(() => expect(emitNotificationSpy).toHaveBeenCalled());

    expect(emitNotificationSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'error',
        severity: 'error',
        title: 'Retry failed, the conversations stay open',
        body: expect.stringContaining('github refused the reply'),
        sessionId: SESSION_ID,
      }),
    );
  });
});
