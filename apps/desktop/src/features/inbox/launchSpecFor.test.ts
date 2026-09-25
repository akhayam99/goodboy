import { describe, expect, it } from 'vitest';
import { launchSpecFor } from './launchSpecFor';
import type { WorkspaceId } from '@goodboy/types';
import type { InboxRecord } from './types';

const workspaceId = 'workspace-1' as WorkspaceId;

const RECORDS: ReadonlyArray<InboxRecord> = [
  {
    key: 'github:issue:1',
    provider: 'github',
    kind: 'issue',
    identifier: '#1',
    title: 'github item',
    state: 'open',
    updatedAt: '2026-08-01T10:00:00Z',
    url: '',
    stateLabel: 'Open',
    context: 'GitHub',
    payload: {
      provider: 'github',
      kind: 'issue',
      issue: {
        number: 1,
        title: 'github item',
        body: '',
        url: '',
        state: 'OPEN',
        labels: [],
        updatedAt: '',
      },
      sessionId: null,
    },
  },
  {
    key: 'gitlab:issue:1',
    provider: 'gitlab',
    kind: 'issue',
    identifier: 'goodboy#1',
    title: 'gitlab item',
    state: 'open',
    updatedAt: '2026-08-01T10:00:00Z',
    url: '',
    stateLabel: 'Open',
    context: 'goodboy',
    payload: {
      provider: 'gitlab',
      kind: 'issue',
      issue: {
        id: 1,
        iid: 1,
        projectId: 1,
        title: 'gitlab item',
        description: null,
        state: 'opened',
        webUrl: '',
        references: { full: 'goodboy#1' },
        updatedAt: '',
        milestone: null,
        labels: [],
      },
      sessionId: null,
    },
  },
  {
    key: 'gitlab:mr:1',
    provider: 'gitlab',
    kind: 'mr',
    identifier: '!1',
    title: 'gitlab mr',
    state: 'open',
    updatedAt: '2026-08-01T10:00:00Z',
    url: '',
    stateLabel: 'Open',
    context: 'goodboy',
    payload: {
      provider: 'gitlab',
      kind: 'mr',
      mr: {
        id: 1,
        iid: 1,
        projectId: 1,
        title: 'gitlab mr',
        description: null,
        state: 'opened',
        webUrl: '',
        sourceBranch: 'feat',
        targetBranch: 'main',
        draft: false,
        hasConflicts: false,
        mergeStatus: 'can_be_merged',
        updatedAt: '',
      },
      host: 'gitlab.com',
    },
  },
  {
    key: 'linear:issue:1',
    provider: 'linear',
    kind: 'issue',
    identifier: 'ENG-1',
    title: 'linear item',
    state: 'open',
    updatedAt: '2026-08-01T10:00:00Z',
    url: '',
    stateLabel: 'Open',
    context: 'ENG',
    payload: {
      provider: 'linear',
      kind: 'issue',
      issue: {
        id: '1',
        identifier: 'ENG-1',
        title: 'linear item',
        description: null,
        url: '',
        state: { name: 'Todo', type: 'unstarted' },
        team: { key: 'ENG' },
        updatedAt: '',
      },
      sessionId: null,
    },
  },
  {
    key: 'jira:issue:1',
    provider: 'jira',
    kind: 'issue',
    identifier: 'GBY-1',
    title: 'jira item',
    state: 'open',
    updatedAt: '2026-08-01T10:00:00Z',
    url: '',
    stateLabel: 'Open',
    context: 'Task · To Do',
    payload: {
      provider: 'jira',
      kind: 'issue',
      issue: {
        id: '1',
        key: 'GBY-1',
        summary: 'jira item',
        description: '',
        status: 'To Do',
        statusCategory: 'new',
        issueType: 'Task',
        priority: null,
        assignee: null,
        reporter: null,
        labels: [],
        created: '',
        updated: '',
        url: '',
      },
      sessionId: null,
    },
  },
  {
    key: 'sentry:error:1',
    provider: 'sentry',
    kind: 'error',
    identifier: 'GBY-1',
    title: 'sentry item',
    state: 'alert',
    updatedAt: '2026-08-01T10:00:00Z',
    url: '',
    stateLabel: 'Open',
    context: 'Sentry',
    payload: {
      provider: 'sentry',
      kind: 'error',
      issue: {
        id: '1',
        shortId: 'GBY-1',
        title: 'sentry item',
        culprit: null,
        level: null,
        status: 'unresolved',
        count: null,
        userCount: null,
        firstSeen: null,
        lastSeen: null,
        permalink: null,
        metadata: null,
      },
      sessionId: null,
    },
  },
  {
    key: 'slack:thread:1',
    provider: 'slack',
    kind: 'thread',
    identifier: '#eng',
    title: 'slack item',
    state: 'active',
    updatedAt: '2026-08-01T10:00:00Z',
    url: '',
    stateLabel: 'Open',
    context: '1 replies',
    payload: {
      provider: 'slack',
      kind: 'thread',
      channel: { id: 'C1', name: 'eng', isMember: true, topic: null, memberCount: 1 },
      head: {
        ts: '1',
        threadTs: '1',
        userId: null,
        botId: null,
        text: 'slack item',
        subtype: null,
        replyCount: 1,
        replyUserCount: 1,
        postedAt: null,
        latestReplyAt: null,
        reactions: [],
      },
      sessionId: null,
    },
  },
  {
    key: 'bitbucket:pr:1',
    provider: 'bitbucket',
    kind: 'pr',
    identifier: '#1',
    title: 'bitbucket item',
    state: 'open',
    updatedAt: '2026-08-01T10:00:00Z',
    url: '',
    stateLabel: 'Open',
    context: 'goodboy/goodboy',
    payload: {
      provider: 'bitbucket',
      kind: 'pr',
      pullRequest: {
        id: 1,
        title: 'bitbucket item',
        description: '',
        state: 'OPEN',
        createdOn: '',
        updatedOn: '',
        sourceBranch: 'feat',
        sourceCommit: null,
        destinationBranch: 'main',
        destinationCommit: null,
        author: null,
        reviewers: [],
        participants: [],
        closeSourceBranch: true,
        mergeCommit: null,
        commentCount: 0,
        taskCount: 0,
        webUrl: null,
      },
      repo: { workspaceId, workspaceSlug: 'goodboy', repoSlug: 'goodboy', email: 'a@b.com' },
    },
  },
];

describe('launchSpecFor', () => {
  it('gives every tool a primary: launch, or open the linked session', () => {
    const specs = RECORDS.map((record) => [record.key, launchSpecFor({ record })] as const);

    expect(specs.length).toBe(8);
    for (const [key, spec] of specs) {
      expect(spec, key).not.toBeNull();
      expect(spec?.externalTask.identifier, key).not.toBe('');
    }
  });

  it('has no launch target for a Bitbucket pull request without its repository', () => {
    const bitbucket = RECORDS.find((record) => record.provider === 'bitbucket');
    if (bitbucket?.payload.provider !== 'bitbucket') {
      throw new Error('missing bitbucket fixture');
    }

    expect(
      launchSpecFor({ record: { ...bitbucket, payload: { ...bitbucket.payload, repo: null } } }),
    ).toBeNull();
  });
});
