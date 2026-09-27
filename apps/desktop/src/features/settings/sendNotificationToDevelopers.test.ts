// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Notification } from '@goodboy/db';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { useAppStore } from '../../store';
import { emptyBugReportDraft } from '../../store/slices/bugReportDraft/state';
import { sendNotificationToDevelopers } from './sendNotificationToDevelopers';

type NotificationFields = {
  readonly title: string;
  readonly body: string | null;
};

const notificationWith = ({ title, body }: NotificationFields): Notification => {
  const value: unknown = {
    id: 'n1',
    ts: '2026-09-02T10:00:00.000Z',
    kind: 'error',
    title,
    body,
    severity: 'error',
    sessionId: null,
    workspaceId: null,
    read: false,
    action: null,
  };
  return JSON.parse(JSON.stringify(value));
};

describe('sendNotificationToDevelopers', () => {
  beforeEach(() => {
    useAppStore.setState({ bugReportDraft: emptyBugReportDraft });
  });

  it('removes secrets, emails, link queries and home paths before the draft sees them', () => {
    sendNotificationToDevelopers({
      notification: notificationWith({
        title: 'Push failed for rowan@example.dev',
        body: 'git push with ghp_AbCdEfGhIjKlMnOpQrSt1234 in /Users/rowan/code/harborline to https://github.com/acme/ledger-core.git?token=abc123def456 failed',
      }),
    });

    const { title, description } = useAppStore.getState().bugReportDraft;
    for (const leak of ['rowan@example.dev', 'ghp_AbCd', '/Users/rowan', 'token=abc123def456']) {
      expect(title).not.toContain(leak);
      expect(description).not.toContain(leak);
    }
    expect(title).toBe('Push failed for [email]');
    expect(description).toContain('in ~/… to');
    expect(description).toContain('https://github.com/… failed');
  });

  it('keeps a title the user already wrote', () => {
    useAppStore.setState({ bugReportDraft: { ...emptyBugReportDraft, title: 'Mine' } });

    sendNotificationToDevelopers({ notification: notificationWith({ title: 'Boom', body: null }) });

    expect(useAppStore.getState().bugReportDraft.title).toBe('Mine');
    expect(useAppStore.getState().bugReportDraft.description).toBe('Boom');
  });
});
