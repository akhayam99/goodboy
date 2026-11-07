import type { NotificationAction } from '@goodboy/db';
import { CommandError } from '../../../shared/lib/invokeCommand';
import { CHECK_STATE, type ErrorRecovery } from './errorRecovery';

type SettingsTool = NonNullable<Extract<NotificationAction, { kind: 'open-settings' }>['tool']>;

type Params = {
  readonly error: unknown;
  readonly tool: SettingsTool;
};

export const hostErrorRecoveryOf = ({ error, tool }: Params): ErrorRecovery => {
  if (!(error instanceof CommandError)) {
    return CHECK_STATE;
  }
  const kind = error.failure?.kind;
  if (kind !== 'bad_credentials' && kind !== 'denied') {
    return CHECK_STATE;
  }
  return { action: { kind: 'open-settings', scope: 'tools', tool } };
};
