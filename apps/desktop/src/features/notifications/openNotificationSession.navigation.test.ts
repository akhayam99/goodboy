// @vitest-environment happy-dom
import { createElement, type ReactNode } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import type { Notification } from '@goodboy/db';
import {
  brandId,
  type IsoDateTime,
  type MountId,
  type SessionId,
  type WorkspaceId,
} from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  buildStoryWorkspace,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../store/storyHarness';
import type { SessionGithubState } from '../../store/types';
import { ToastProvider } from '../../shared/components/Toast';
import { locationKey } from '../../store/slices/navigation/locationKey';
import type { AttentionTarget } from '../session/attentionTarget';
import { attentionTargetChannel } from '../session/attentionTargetChannel';
import { useAttentionTargets } from '../session/hooks/useAttentionTargets';
import { landAttentionTarget } from '../session/landAttentionTarget';
import { openPlaceLabelOf } from './components/NotificationToastBridge/openPlaceLabelOf';
import { openNotificationSession } from './openNotificationSession';

const WS = brandId<WorkspaceId>({ value: 'ws-harborline' });
const OTHER_WS = brandId<WorkspaceId>({ value: 'ws-northwind' });
const SESSION = brandId<SessionId>({ value: 'session-ledger-core' });
const MOUNT = brandId<MountId>({ value: 'mount-ledger-core' });
const CHECKS_TARGET: AttentionTarget = {
  workspaceId: WS,
  sessionId: SESSION,
  reason: null,
  agentId: null,
  place: { reason: 'ci-failed', mountId: MOUNT },
};

const githubWithFailingPr = (): SessionGithubState => ({
  pr: {
    number: 528,
    title: 'Guard the settlement batch',
    url: 'https://github.com/harborline/ledger-core/pull/528',
    state: 'open',
    mergeable: true,
    checks: 'failure',
    baseBranch: 'main',
    headBranch: 'fix/ledger-postings',
    isDraft: false,
    reviewDecision: null,
    body: '',
    updatedAt: '2026-11-06T09:00:00.000Z',
  },
  linkedIssues: [],
  fetchedAt: null,
  failedAt: null,
  loading: false,
  error: null,
  detail: null,
  detailFetchedAt: null,
  detailLoading: false,
  detailError: null,
});

type NotificationParams = Readonly<{
  reason: 'ci-failed' | 'fix-needs-you';
  subject?: 'note' | 'comment';
}>;

const notificationOf = ({ reason, subject }: NotificationParams): Notification => ({
  id: 'n-ledger',
  ts: brandId<IsoDateTime>({ value: '2026-11-06T09:00:00.000Z' }),
  kind: 'error',
  title: 'Open the branch',
  body: null,
  severity: 'warning',
  sessionId: SESSION,
  workspaceId: WS,
  read: false,
  coalesceKey: null,
  actedAt: null,
  action: {
    kind: 'open-place',
    sessionId: SESSION,
    reason,
    mountId: MOUNT,
    ...(subject === undefined ? {} : { subject }),
  },
});

let useAppStore: StoryStore;

const keyOfCurrent = (): string => {
  const state = useAppStore.getState();
  const stack = state.navigation[state.currentWorkspaceId ?? ''];
  const entry = stack?.entries[stack.index];
  return entry === undefined ? '' : locationKey(entry);
};

const order: Array<string> = [];

const toastWrapper = ({ children }: { readonly children: ReactNode }) =>
  createElement(ToastProvider, null, children);

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  localStorage.clear();
  order.length = 0;
  useAppStore.setState({
    currentWorkspaceId: WS,
    boardReady: true,
    switchingToWorkspaceId: null,
    workspaces: [
      buildStoryWorkspace({ id: WS, name: 'Harborline', slug: 'harborline' }),
      buildStoryWorkspace({ id: OTHER_WS, name: 'Northwind', slug: 'northwind' }),
    ],
    sessions: [aSession({ id: SESSION })],
    navigation: {},
    sessionGithub: {},
    sessionProjectMounts: {},
    setCurrentSession: async (id: SessionId | null) => {
      useAppStore.setState({ currentSessionId: id });
    },
    refreshReviewSource: vi.fn(async () => {
      order.push(keyOfCurrent().includes('/branch') ? 'refresh-after-landing' : 'refresh');
      useAppStore.setState({ sessionGithub: { [SESSION]: githubWithFailingPr() } });
    }),
    loadDiffComments: vi.fn(async () => {
      order.push('comments');
    }),
    loadResolveSession: vi.fn(async () => {
      order.push('resolve');
    }),
  });
});

afterEach(cleanup);

describe('openNotificationSession with the real navigation', () => {
  it('keeps the Checks tab of a notification when the request data is not loaded yet', async () => {
    openNotificationSession({ notification: notificationOf({ reason: 'ci-failed' }) });

    await vi.waitFor(() => expect(keyOfCurrent()).toContain(`s/${SESSION}/branch`));
    expect(keyOfCurrent()).toContain('checks');
    expect(order).toEqual(expect.arrayContaining(['refresh', 'comments', 'resolve']));
  });

  it('keeps the Comments tab of a fix when the request data is not loaded yet', async () => {
    openNotificationSession({
      notification: notificationOf({ reason: 'fix-needs-you', subject: 'comment' }),
    });

    await vi.waitFor(() => expect(keyOfCurrent()).toContain(`s/${SESSION}/branch`));
    expect(keyOfCurrent()).toContain('comments');
    expect(order).toEqual(expect.arrayContaining(['refresh', 'comments', 'resolve']));
  });

  it('lands a note fix on Changes, the place its Open Changes label says', async () => {
    const notification = notificationOf({ reason: 'fix-needs-you', subject: 'note' });
    const label = openPlaceLabelOf({
      state: useAppStore.getState(),
      sessionId: SESSION,
      reason: 'fix-needs-you',
      mountId: MOUNT,
      subject: 'note',
    });

    openNotificationSession({ notification });

    await vi.waitFor(() => expect(keyOfCurrent()).toContain(`s/${SESSION}/branch`));
    expect(label).toBe('Open Changes');
    expect(keyOfCurrent()).toContain('files');
  });

  it('reports a failed load and still opens the branch', async () => {
    const reportError = vi.fn(async () => undefined);
    useAppStore.setState({
      reportError,
      loadDiffComments: vi.fn(async () => {
        throw new Error('database is locked');
      }),
    });

    openNotificationSession({ notification: notificationOf({ reason: 'ci-failed' }) });

    await vi.waitFor(() => expect(keyOfCurrent()).toContain(`s/${SESSION}/branch`));
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Couldn't load this branch before opening it" }),
    );
  });

  it('opens the workspace of a notification from elsewhere, then lands on its exact tab', async () => {
    const openWorkspace = vi.fn(async () => {
      useAppStore.setState({ currentWorkspaceId: WS });
      return { kind: 'opened' } as const;
    });
    useAppStore.setState({ currentWorkspaceId: OTHER_WS, openWorkspace });

    openNotificationSession({ notification: notificationOf({ reason: 'ci-failed' }) });

    await vi.waitFor(() => expect(keyOfCurrent()).toContain('checks'));
    expect(openWorkspace).toHaveBeenCalledWith({
      id: WS,
      title: 'Harborline',
      onRunning: 'new-window',
    });
    expect(order).toEqual(expect.arrayContaining(['refresh', 'comments', 'resolve']));
  });

  it('leaves the exact place to the window that shows the workspace', async () => {
    const openWorkspace = vi.fn(async () => ({ kind: 'opened' }) as const);
    useAppStore.setState({ currentWorkspaceId: OTHER_WS, openWorkspace });

    openNotificationSession({ notification: notificationOf({ reason: 'ci-failed' }) });

    await vi.waitFor(() => expect(openWorkspace).toHaveBeenCalledOnce());
    await Promise.resolve();
    expect(order).toEqual([]);

    useAppStore.setState({ currentWorkspaceId: WS });
    renderHook(() => useAttentionTargets(), { wrapper: toastWrapper });

    await vi.waitFor(() => expect(keyOfCurrent()).toContain('checks'));
    expect(order).toEqual(expect.arrayContaining(['refresh', 'comments', 'resolve']));
    expect(attentionTargetChannel.take({ workspaceId: WS, now: Date.now() })).toBeNull();
  });

  it('drops a landing when a newer tap arrives while its data loads', async () => {
    let release: () => void = () => undefined;
    useAppStore.setState({
      loadDiffComments: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            release = resolve;
          }),
      ),
    });

    const first = landAttentionTarget({ target: CHECKS_TARGET });
    await vi.waitFor(() => expect(order).toContain('refresh'));
    await landAttentionTarget({ target: { ...CHECKS_TARGET, place: undefined } });
    release();
    await first;

    expect(keyOfCurrent()).toContain(SESSION);
    expect(keyOfCurrent()).not.toContain('checks');
  });

  it('drops a landing when the window leaves the workspace while its data loads', async () => {
    let release: () => void = () => undefined;
    useAppStore.setState({
      loadDiffComments: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            release = resolve;
          }),
      ),
    });

    const landing = landAttentionTarget({ target: CHECKS_TARGET });
    await vi.waitFor(() => expect(order).toContain('refresh'));
    useAppStore.setState({ currentWorkspaceId: OTHER_WS });
    release();
    await landing;

    expect(keyOfCurrent()).toBe('');
  });
});
