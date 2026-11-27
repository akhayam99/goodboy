import type { NotificationAction } from '@goodboy/db';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { registerActionRetry, type ActionRetry } from './actionRetries';
import { ERROR_CLAUSE_TEXT, type ErrorRecovery } from './errorRecovery';
import { isErrorRepeatAllowed } from './errorRepeatLimit';
import { notificationKeyOf } from './notificationKeyOf';
import type { GetFn } from './types';

const REPORT_ERROR_BODY_LIMIT = 600;

export type ReportErrorParams = {
  title: string;
  error: unknown;
  severity?: 'error' | 'warning';
  sessionId?: SessionId;
  workspaceId?: WorkspaceId;
  recovery: ErrorRecovery;
  coalesceKey?: string;
  retry?: ActionRetry;
  retryLabel?: string;
  stays?: string;
  isRepeating?: boolean;
};

type TruncateParams = {
  readonly text: string;
};

const truncateBody = ({ text }: TruncateParams): string =>
  text.length > REPORT_ERROR_BODY_LIMIT ? `${text.slice(0, REPORT_ERROR_BODY_LIMIT - 1)}…` : text;

type BodyParams = {
  readonly text: string;
  readonly recovery: ErrorRecovery;
  readonly stays: string | undefined;
};

const errorBodyOf = ({ text, recovery, stays }: BodyParams): string | null => {
  const cause = text === '' ? '' : truncateBody({ text });
  const clause = stays ?? (recovery.clause === undefined ? '' : ERROR_CLAUSE_TEXT[recovery.clause]);
  const body = [cause, clause].filter((part) => part !== '').join('\n');
  return body === '' ? null : body;
};

type FactoryParams = {
  readonly get: GetFn;
};

export const reportError = ({ get }: FactoryParams) => {
  return async ({
    title,
    error,
    severity = 'error',
    recovery,
    retry,
    retryLabel,
    stays,
    coalesceKey,
    isRepeating,
    ...target
  }: ReportErrorParams) => {
    if (
      isRepeating === true &&
      !isErrorRepeatAllowed({
        key: notificationKeyOf({ kind: 'error', severity, title, ...target }),
      })
    ) {
      return;
    }
    const text = formatError(error).trim();
    const action: NotificationAction | undefined =
      retry === undefined
        ? recovery.action
        : {
            kind: 'retry-action',
            retryId: registerActionRetry({
              retry,
              ...(coalesceKey === undefined ? {} : { retryId: coalesceKey }),
            }),
            ...(retryLabel === undefined ? {} : { label: retryLabel }),
          };
    await get().emitNotification({
      kind: 'error',
      severity,
      title,
      body: errorBodyOf({ text, recovery, stays }),
      ...(action !== undefined && { action }),
      ...(coalesceKey === undefined ? {} : { coalesceKey }),
      ...target,
    });
  };
};
