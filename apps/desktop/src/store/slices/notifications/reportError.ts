import type { SessionId, WorkspaceId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { ERROR_CLAUSE_TEXT, type ErrorRecovery } from './errorRecovery';
import type { GetFn } from './types';

const REPORT_ERROR_BODY_LIMIT = 600;

export type ReportErrorParams = {
  title: string;
  error: unknown;
  severity?: 'error' | 'warning';
  sessionId?: SessionId;
  workspaceId?: WorkspaceId;
  recovery?: ErrorRecovery | undefined;
  coalesceKey?: string;
};

const truncateBody = ({ text }: { text: string }): string =>
  text.length > REPORT_ERROR_BODY_LIMIT ? `${text.slice(0, REPORT_ERROR_BODY_LIMIT - 1)}…` : text;

type BodyParams = {
  readonly text: string;
  readonly recovery: ErrorRecovery | undefined;
};

const errorBodyOf = ({ text, recovery }: BodyParams): string | null => {
  const cause = text === '' ? '' : truncateBody({ text });
  const clause = recovery?.clause === undefined ? '' : ERROR_CLAUSE_TEXT[recovery.clause];
  const body = [cause, clause].filter((part) => part !== '').join('\n');
  return body === '' ? null : body;
};

export const reportError = (get: GetFn) => {
  return async ({ title, error, severity = 'error', recovery, ...target }: ReportErrorParams) => {
    const text = formatError(error).trim();
    await get().emitNotification({
      kind: 'error',
      severity,
      title,
      body: errorBodyOf({ text, recovery }),
      ...(recovery?.action !== undefined && { action: recovery.action }),
      ...target,
    });
  };
};
