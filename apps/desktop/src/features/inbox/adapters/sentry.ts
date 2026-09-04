import type { SentryIssueRow } from '../../integrations/sentry/SentryStudio/useSentryIssues';
import type { InboxRecord } from '../types';

type RecordKeyParams = { readonly issueId: string };

export const sentryRecordKey = ({ issueId }: RecordKeyParams): string => `sentry:error:${issueId}`;

type Params = { readonly rows: ReadonlyArray<SentryIssueRow> };
export const adaptSentryIssues = ({ rows }: Params): InboxRecord[] =>
  rows.map(({ issue, sessionId }) => ({
    key: sentryRecordKey({ issueId: issue.id }),
    provider: 'sentry',
    kind: 'error',
    identifier: issue.shortId ?? issue.id,
    title: issue.title,
    state: issue.status === 'resolved' || issue.status === 'ignored' ? 'done' : 'alert',
    updatedAt: issue.lastSeen ?? issue.firstSeen ?? '',
    url: issue.permalink ?? '',
    meta: issue.culprit ?? issue.level ?? 'Sentry',
    payload: { provider: 'sentry', kind: 'error', issue, sessionId },
  }));
