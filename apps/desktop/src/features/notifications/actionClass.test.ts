import { describe, expect, it } from 'vitest';
import type { NotificationAction } from '@goodboy/db';
import { isNotificationDebt, notificationActionClass } from './actionClass';

const KINDS = [
  'retry-summarizer',
  'retry-orchestrator',
  'retry-step-summary',
  'retry-publication',
  'retry-update',
  'update-provider-cli',
  'open-agent',
  'open-budget',
  'open-orphan-worktrees',
  'open-storage',
  'open-lens',
  'open-activity',
  'open-settings',
  'reveal-path',
  'retry-push',
] as const satisfies ReadonlyArray<NotificationAction['kind']>;

describe('notificationActionClass', () => {
  it('calls a retry or an update a debt and every open a pointer', () => {
    expect(
      Object.fromEntries(KINDS.map((kind) => [kind, notificationActionClass({ kind })])),
    ).toEqual({
      'retry-summarizer': 'debt',
      'retry-orchestrator': 'debt',
      'retry-step-summary': 'debt',
      'retry-publication': 'debt',
      'retry-update': 'debt',
      'update-provider-cli': 'debt',
      'open-agent': 'pointer',
      'open-budget': 'pointer',
      'open-orphan-worktrees': 'pointer',
      'open-storage': 'pointer',
      'open-lens': 'pointer',
      'open-activity': 'pointer',
      'open-settings': 'pointer',
      'reveal-path': 'pointer',
      'retry-push': 'debt',
    });
  });

  it('owes nothing without an action', () => {
    expect(isNotificationDebt({ notification: { action: null } })).toBe(false);
    expect(isNotificationDebt({ notification: { action: { kind: 'retry-update' } } })).toBe(true);
  });
});
