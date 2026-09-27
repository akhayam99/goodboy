import { describe, expect, it, vi } from 'vitest';
import type { IsoDateTime, StarredIssue, WorkspaceId } from '@goodboy/types';
import type { InboxRecord } from '../../inbox/types';

const { lookup } = vi.hoisted(() => ({ lookup: vi.fn() }));
vi.mock('../issueCode/lookupIssueByCode', () => ({ lookupIssueByCode: lookup }));

import { refreshStarredIssues } from './refreshStarredIssues';
import { lookupTargetOf, starIdentityOf, starredIssueOf } from './starredIssueOf';

const WORKSPACE = 'ws-harborline' as WorkspaceId;
const NOW = '2026-09-27T10:00:00.000Z' as IsoDateTime;

const star = (patch: Partial<StarredIssue>): StarredIssue => ({
  workspaceId: WORKSPACE,
  provider: 'linear',
  externalId: 'lin-1',
  identifier: 'CAS-231',
  container: null,
  title: 'Settle the month close',
  url: 'https://linear.app/cascadia/issue/CAS-231',
  state: 'open',
  stateLabel: 'Todo',
  starredAt: NOW,
  refreshedAt: null,
  ...patch,
});

const githubRecord = {
  key: 'github:issue:482',
  provider: 'github',
  kind: 'issue',
  identifier: '#482',
  title: 'Checkout total rounds down',
  state: 'open',
  stateLabel: 'Open',
  updatedAt: NOW,
  url: 'https://github.com/acme/storefront-web/issues/482',
  context: 'acme/storefront-web',
  payload: {
    provider: 'github',
    kind: 'issue',
    sessionId: null,
    issue: { number: 482, url: 'https://github.com/acme/storefront-web/issues/482' },
  },
} as unknown as InboxRecord;

describe('star identity', () => {
  it('keys a GitHub issue by its repo and number so two repos never collide', () => {
    expect(starIdentityOf(githubRecord)).toEqual({
      provider: 'github',
      externalId: 'acme/storefront-web#482',
      container: 'acme/storefront-web',
    });
    const issue = starredIssueOf({ workspaceId: WORKSPACE, record: githubRecord, now: NOW });
    expect(issue === null ? null : lookupTargetOf(issue)).toEqual({
      provider: 'github',
      repo: 'acme/storefront-web',
      number: 482,
    });
  });

  it('refuses what is not an issue', () => {
    expect(
      starIdentityOf({ ...githubRecord, payload: { provider: 'slack' } } as unknown as InboxRecord),
    ).toBeNull();
  });
});

describe('refreshStarredIssues', () => {
  it('updates the found ones, marks the gone ones missing, and keeps the rest', async () => {
    const found = star({});
    const gone = star({ provider: 'jira', externalId: 'j-9', identifier: 'NW-230' });
    const unreachable = star({ provider: 'sentry', externalId: '91', identifier: 'NOTIFY-3F' });
    lookup.mockResolvedValueOnce({
      hits: [
        {
          target: { provider: 'linear', identifier: 'CAS-231' },
          candidate: {},
          record: {
            ...githubRecord,
            identifier: 'CAS-231',
            title: 'Close the month',
            state: 'done',
            stateLabel: 'Done',
          },
        },
      ],
      misses: [
        { target: { provider: 'jira', key: 'NW-230' }, failure: 'not-found' },
        { target: { provider: 'sentry-id', issueId: '91' }, failure: 'unreachable' },
      ],
    });

    const refreshed = await refreshStarredIssues({
      workspaceId: WORKSPACE,
      gitlabHost: null,
      jiraConfig: null,
      issues: [found, gone, unreachable],
      now: NOW,
    });

    expect(refreshed.snapshots).toEqual([
      {
        ...found,
        title: 'Close the month',
        url: githubRecord.url,
        state: 'done',
        stateLabel: 'Done',
        refreshedAt: NOW,
      },
      { ...gone, state: 'missing', refreshedAt: NOW },
    ]);
    expect(Object.keys(refreshed.records)).toEqual(['linear:lin-1']);
  });
});
