import type { NotificationAction } from '@goodboy/db';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import type { GetFn } from './types';

export const REPORT_ERROR_BODY_LIMIT = 600;

export type ReportErrorParams = {
  title: string;
  error: unknown;
  severity?: 'error' | 'warning';
  sessionId?: SessionId;
  workspaceId?: WorkspaceId;
  action?: NotificationAction;
  coalesceKey?: string;
};

const truncateBody = ({ text }: { text: string }): string =>
  text.length > REPORT_ERROR_BODY_LIMIT ? `${text.slice(0, REPORT_ERROR_BODY_LIMIT - 1)}…` : text;

export const reportError = (get: GetFn) => {
  return async ({ title, error, severity = 'error', ...target }: ReportErrorParams) => {
    const text = formatError(error).trim();
    await get().emitNotification({
      kind: 'error',
      severity,
      title,
      body: text === '' ? null : truncateBody({ text }),
      ...target,
    });
  };
};
