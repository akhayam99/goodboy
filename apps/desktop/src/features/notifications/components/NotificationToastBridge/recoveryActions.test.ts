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

const revealSpy = vi.hoisted(() => vi.fn(async (_params: { path: string }) => undefined));

vi.mock('../../../../shared/lib/reveal', () => ({
  revealInFileManager: (params: { path: string }) => revealSpy(params),
}));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotificationAction } from '@goodboy/db';
import { brandId, type MountId, type SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { mapNotificationAction } from './';

const SESSION_ID = brandId<SessionId>({ value: 'session-1' });
const MOUNT_ID = brandId<MountId>({ value: 'mount-1' });

let useAppStore: StoryStore;

const pushBranchSpy = vi.fn();
const reportErrorSpy = vi.fn(async (_params: unknown) => undefined);
const resolveNotificationsSpy = vi.fn(async (_keys: ReadonlyArray<string>) => undefined);

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const mapAction = (action: NotificationAction) =>
  mapNotificationAction(action, useAppStore.getState());

describe('recovery actions of a reported error', () => {
  let opened: Array<unknown>;
  const onOpenSettings = (event: Event) => {
    opened.push(event instanceof CustomEvent ? event.detail : null);
  };

  beforeEach(async () => {
    await resetStoryStore();
    vi.clearAllMocks();
    opened = [];
    useAppStore.setState({
      pushBranch: pushBranchSpy,
      reportError: reportErrorSpy,
      resolveNotifications: resolveNotificationsSpy,
    });
    window.addEventListener('goodboy:open-settings', onOpenSettings);
  });

  afterEach(() => {
    window.removeEventListener('goodboy:open-settings', onOpenSettings);
  });

  it('open-settings: opens the named settings page', () => {
    const toastAction = mapAction({ kind: 'open-settings', scope: 'app', section: 'general' });
    expect(toastAction?.label).toBe('Open settings');
    toastAction?.onClick();
    expect(opened).toEqual([{ scope: 'app', section: 'general' }]);
  });

  it('open-settings: opens the providers page', () => {
    mapAction({ kind: 'open-settings', scope: 'providers' })?.onClick();
    expect(opened).toEqual([{ scope: 'providers' }]);
  });

  it('open-settings: names the tool to reconnect and opens its page', () => {
    const toastAction = mapAction({ kind: 'open-settings', scope: 'tools', tool: 'gitlab' });
    expect(toastAction?.label).toBe('Reconnect GitLab');
    toastAction?.onClick();
    expect(opened).toEqual([{ scope: 'tools', tool: 'gitlab' }]);
  });

  it('reveal-path: shows that folder in Finder', async () => {
    const toastAction = mapAction({ kind: 'reveal-path', path: '/Users/dev/payments-api' });
    expect(toastAction?.label).toBe('Show in Finder');
    toastAction?.onClick();
    await vi.waitFor(() =>
      expect(revealSpy).toHaveBeenCalledWith({ path: '/Users/dev/payments-api' }),
    );
    expect(reportErrorSpy).not.toHaveBeenCalled();
  });

  it('reveal-path: reports a folder that cannot be shown', async () => {
    revealSpy.mockRejectedValueOnce(new Error('no such folder'));
    mapAction({ kind: 'reveal-path', path: '/Users/dev/gone' })?.onClick();
    await vi.waitFor(() =>
      expect(reportErrorSpy).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Couldn't show the folder" }),
      ),
    );
  });

  it('retry-push: pushes that mount of that session again and clears the failure', async () => {
    pushBranchSpy.mockResolvedValueOnce({ ok: true });
    const toastAction = mapAction({ kind: 'retry-push', sessionId: SESSION_ID, mountId: MOUNT_ID });
    expect(toastAction?.label).toBe('Retry push');
    toastAction?.onClick();
    await vi.waitFor(() =>
      expect(resolveNotificationsSpy).toHaveBeenCalledWith(['push-failed:mount-1']),
    );
    expect(pushBranchSpy).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      mountId: MOUNT_ID,
      mode: 'plain',
    });
    expect(reportErrorSpy).not.toHaveBeenCalled();
  });

  it('retry-push: a push that fails again keeps the failure and offers the retry again', async () => {
    pushBranchSpy.mockResolvedValueOnce({ ok: false, error: 'remote rejected', reason: 'failed' });
    mapAction({ kind: 'retry-push', sessionId: SESSION_ID, mountId: MOUNT_ID })?.onClick();
    await vi.waitFor(() => expect(reportErrorSpy).toHaveBeenCalled());
    expect(resolveNotificationsSpy).not.toHaveBeenCalled();
    expect(reportErrorSpy).toHaveBeenCalledWith({
      title: "Couldn't push the branch",
      error: 'remote rejected',
      sessionId: SESSION_ID,
      coalesceKey: 'push-failed:mount-1',
      recovery: {
        action: { kind: 'retry-push', sessionId: SESSION_ID, mountId: MOUNT_ID },
        clause: 'work-kept',
      },
    });
  });
});
