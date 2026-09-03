import { describe, expect, it } from 'vitest';
import type { SessionId } from '@goodboy/types';
import type { SentryIssue } from '../../integrations/sentry/client';
import type { SentryIssueRow } from '../../integrations/sentry/SentryStudio/useSentryIssues';
import { adaptSentryIssues } from './sentry';

const issue = (overrides: Partial<SentryIssue> = {}): SentryIssue => ({
  id: 'issue-1',
  shortId: 'GOODBOY-1',
  title: 'TypeError in launch panel',
  culprit: 'launchSession',
  level: 'error',
  status: 'unresolved',
  count: '12',
  userCount: 4,
  firstSeen: '2026-07-01T10:00:00Z',
  lastSeen: '2026-08-01T10:00:00Z',
  permalink: 'https://sentry.io/organizations/goodboy/issues/1/',
  metadata: null,
  ...overrides,
});

describe('adaptSentryIssues', () => {
  it('maps an issue row into a normalized inbox record', () => {
    const sessionId = 'session-1' as SessionId;
    const rows: ReadonlyArray<SentryIssueRow> = [{ issue: issue(), sessionId }];

    const [record] = adaptSentryIssues({ rows });

    expect(record).toEqual({
      key: 'sentry:error:issue-1',
      provider: 'sentry',
      kind: 'error',
      identifier: 'GOODBOY-1',
      title: 'TypeError in launch panel',
      state: 'alert',
      updatedAt: '2026-08-01T10:00:00Z',
      url: 'https://sentry.io/organizations/goodboy/issues/1/',
      meta: 'launchSession',
      payload: { provider: 'sentry', kind: 'error', issue: issue(), sessionId },
    });
  });

  it.each([
    ['resolved', 'done'],
    ['ignored', 'done'],
    ['unresolved', 'alert'],
  ] as const)('normalizes status %s to %s', (status, expected) => {
    const rows: ReadonlyArray<SentryIssueRow> = [{ issue: issue({ status }), sessionId: null }];

    const [record] = adaptSentryIssues({ rows });

    expect(record?.state).toBe(expected);
  });

  it('falls back through identifier, timestamp and meta when data is missing', () => {
    const rows: ReadonlyArray<SentryIssueRow> = [
      {
        issue: issue({
          shortId: null,
          culprit: null,
          level: 'warning',
          lastSeen: null,
          firstSeen: '2026-07-01T10:00:00Z',
          permalink: null,
        }),
        sessionId: null,
      },
    ];

    const [record] = adaptSentryIssues({ rows });

    expect(record?.identifier).toBe('issue-1');
    expect(record?.updatedAt).toBe('2026-07-01T10:00:00Z');
    expect(record?.meta).toBe('warning');
    expect(record?.url).toBe('');
  });
});
