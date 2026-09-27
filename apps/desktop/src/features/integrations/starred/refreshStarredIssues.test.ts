import { describe, expect, it, vi } from 'vitest';
import type { IsoDateTime, StarredIssue, WorkspaceId } from '@goodboy/types';
import type { InboxRecord } from '../../inbox/types';

const { lookup, linearFetchIssuesByIds, jiraGetIssues, gitlabFetchIssues } = vi.hoisted(() => ({
  lookup: vi.fn(),
  linearFetchIssuesByIds: vi.fn(),
  jiraGetIssues: vi.fn(),
  gitlabFetchIssues: vi.fn(),
}));
vi.mock('../issueCode/lookupIssueByCode', () => ({ lookupIssueByCode: lookup }));
vi.mock('../linear/client', () => ({ linearFetchIssuesByIds }));
vi.mock('../jira/client', () => ({ jiraGetIssues }));
vi.mock('../gitlab/client', () => ({ gitlabFetchIssues }));

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
  it('batches Linear, Jira and GitLab into one request per tracker, and keeps GitHub/Sentry per issue', async () => {
    const linearOne = star({ provider: 'linear', externalId: 'lin-1', identifier: 'CAS-231' });
    const linearTwo = star({ provider: 'linear', externalId: 'lin-2', identifier: 'CAS-232' });
    const jiraOne = star({ provider: 'jira', externalId: 'j-9', identifier: 'NW-230' });
    const sentryOne = star({ provider: 'sentry', externalId: '91', identifier: 'NOTIFY-3F' });

    linearFetchIssuesByIds.mockResolvedValueOnce([
      {
        id: 'lin-1',
        identifier: 'CAS-231',
        title: 'Close the month',
        description: null,
        url: 'https://linear.app/cascadia/issue/CAS-231',
        state: { name: 'Done', type: 'completed' },
        team: { key: 'CAS' },
        labels: { nodes: [] },
        updatedAt: NOW,
        branchName: '',
        attachments: { nodes: [] },
      },
    ]);
    lookup.mockResolvedValueOnce({
      hits: [],
      misses: [{ target: { provider: 'sentry-id', issueId: '91' }, failure: 'unreachable' }],
    });

    const refreshed = await refreshStarredIssues({
      workspaceId: WORKSPACE,
      gitlabHost: null,
      jiraConfig: null,
      issues: [linearOne, linearTwo, jiraOne, sentryOne],
      now: NOW,
    });

    expect(linearFetchIssuesByIds).toHaveBeenCalledTimes(1);
    expect(linearFetchIssuesByIds).toHaveBeenCalledWith({
      workspaceId: WORKSPACE,
      issueIds: ['CAS-231', 'CAS-232'],
    });
    expect(jiraGetIssues).not.toHaveBeenCalled();
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(lookup).toHaveBeenCalledWith(
      expect.objectContaining({ targets: [{ provider: 'sentry-id', issueId: '91' }] }),
    );

    expect(refreshed.snapshots).toEqual([
      {
        ...linearOne,
        title: 'Close the month',
        url: 'https://linear.app/cascadia/issue/CAS-231',
        state: 'done',
        stateLabel: 'Done',
        refreshedAt: NOW,
      },
      { ...linearTwo, state: 'missing', refreshedAt: NOW },
    ]);
    expect(Object.keys(refreshed.records)).toEqual(['linear:lin-1']);
  });

  it('asks Jira once with every starred key, when a Jira connection is configured', async () => {
    const jiraOne = star({ provider: 'jira', externalId: 'j-9', identifier: 'NW-142' });
    const jiraTwo = star({ provider: 'jira', externalId: 'j-10', identifier: 'NW-143' });
    jiraGetIssues.mockResolvedValueOnce([
      {
        id: 'j-9',
        key: 'NW-142',
        summary: 'Reconcile the payout ledger',
        description: '',
        status: 'In Progress',
        statusCategory: 'indeterminate',
        issueType: 'Task',
        priority: null,
        assignee: null,
        reporter: null,
        labels: [],
        created: NOW,
        updated: NOW,
        url: 'https://northwind.atlassian.net/browse/NW-142',
      },
    ]);

    const refreshed = await refreshStarredIssues({
      workspaceId: WORKSPACE,
      gitlabHost: null,
      jiraConfig: {
        siteUrl: 'https://northwind.atlassian.net',
        email: 'mara@northwind.dev',
      } as never,
      issues: [jiraOne, jiraTwo],
      now: NOW,
    });

    expect(jiraGetIssues).toHaveBeenCalledTimes(1);
    expect(jiraGetIssues).toHaveBeenCalledWith({
      workspaceId: WORKSPACE,
      siteUrl: 'https://northwind.atlassian.net',
      email: 'mara@northwind.dev',
      issueKeys: ['NW-142', 'NW-143'],
    });
    expect(refreshed.snapshots).toEqual([
      {
        ...jiraOne,
        title: 'Reconcile the payout ledger',
        url: 'https://northwind.atlassian.net/browse/NW-142',
        state: 'active',
        stateLabel: 'In Progress',
        refreshedAt: NOW,
      },
      { ...jiraTwo, state: 'missing', refreshedAt: NOW },
    ]);
  });

  it('leaves a tracker untouched, not missing, when the whole batch call fails', async () => {
    const linearOne = star({ provider: 'linear', externalId: 'lin-1', identifier: 'CAS-231' });
    linearFetchIssuesByIds.mockRejectedValueOnce(new Error('rate limited'));

    const refreshed = await refreshStarredIssues({
      workspaceId: WORKSPACE,
      gitlabHost: null,
      jiraConfig: null,
      issues: [linearOne],
      now: NOW,
    });

    expect(refreshed.snapshots).toEqual([]);
    expect(refreshed.records).toEqual({});
  });

  it('batches GitLab per project, one request per project', async () => {
    const issueA = star({
      provider: 'gitlab',
      externalId: '501',
      identifier: 'payments/api#12',
      container: 'payments/api',
    });
    const issueB = star({
      provider: 'gitlab',
      externalId: '502',
      identifier: 'payments/api#13',
      container: 'payments/api',
    });
    const issueC = star({
      provider: 'gitlab',
      externalId: '601',
      identifier: 'notify/relay#4',
      container: 'notify/relay',
    });
    gitlabFetchIssues.mockImplementation(({ projectPath }: { projectPath: string }) =>
      Promise.resolve(
        projectPath === 'payments/api'
          ? [
              {
                id: 501,
                iid: 12,
                projectId: 9,
                title: 'Refund split rounds down',
                description: null,
                state: 'opened',
                webUrl: 'https://gitlab.acme.dev/payments/api/-/issues/12',
                references: { full: 'payments/api#12' },
                updatedAt: NOW,
                milestone: null,
                labels: [],
              },
            ]
          : [],
      ),
    );

    const refreshed = await refreshStarredIssues({
      workspaceId: WORKSPACE,
      gitlabHost: 'https://gitlab.acme.dev',
      jiraConfig: null,
      issues: [issueA, issueB, issueC],
      now: NOW,
    });

    expect(gitlabFetchIssues).toHaveBeenCalledTimes(2);
    expect(gitlabFetchIssues).toHaveBeenCalledWith({
      workspaceId: WORKSPACE,
      host: 'https://gitlab.acme.dev',
      projectPath: 'payments/api',
      issueIids: [12, 13],
    });
    expect(gitlabFetchIssues).toHaveBeenCalledWith({
      workspaceId: WORKSPACE,
      host: 'https://gitlab.acme.dev',
      projectPath: 'notify/relay',
      issueIids: [4],
    });
    expect(refreshed.snapshots.map((snapshot) => [snapshot.externalId, snapshot.state])).toEqual([
      ['501', 'open'],
      ['502', 'missing'],
      ['601', 'missing'],
    ]);
  });
});
