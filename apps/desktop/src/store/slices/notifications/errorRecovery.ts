import type { NotificationAction } from '@goodboy/db';

export type ErrorClause =
  'nothing-changed' | 'work-kept' | 'check-state' | 'read-failed' | 'open-failed';

export const ERROR_CLAUSE_TEXT = {
  'nothing-changed': 'Nothing was changed.',
  'work-kept': 'Your work is still on the branch.',
  'check-state': 'Check the current state before trying again.',
  'read-failed': 'Try loading it again.',
  'open-failed': 'Try opening it again.',
} as const satisfies Record<ErrorClause, string>;

export type ErrorRecovery =
  | {
      readonly action: NotificationAction;
      readonly clause?: ErrorClause;
    }
  | {
      readonly action?: undefined;
      readonly clause: ErrorClause;
    };

export const NOTHING_CHANGED: ErrorRecovery = { clause: 'nothing-changed' };

export const WORK_KEPT: ErrorRecovery = { clause: 'work-kept' };

export const OPEN_APP_SETTINGS_GENERAL: ErrorRecovery = {
  action: { kind: 'open-settings', scope: 'app', section: 'general' },
};

export const OPEN_PROVIDER_SETTINGS: ErrorRecovery = {
  action: { kind: 'open-settings', scope: 'providers' },
};

export const CHECK_STATE: ErrorRecovery = { clause: 'check-state' };

export const READ_FAILED: ErrorRecovery = { clause: 'read-failed' };

export const OPEN_FAILED: ErrorRecovery = { clause: 'open-failed' };
