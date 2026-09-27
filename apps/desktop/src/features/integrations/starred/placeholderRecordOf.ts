import type { StarredIssue } from '@goodboy/types';
import type { InboxRecord, InboxState } from '../../inbox/types';
import { parseIssueCode } from '../issueCode/parseIssueCode';

const recordStateOf = (state: StarredIssue['state']): InboxState =>
  state === 'missing' ? 'alert' : state;

const rawLinearStateType = (state: StarredIssue['state']): string =>
  state === 'done' ? 'completed' : state === 'active' ? 'started' : 'backlog';

const rawJiraStatusCategory = (
  state: StarredIssue['state'],
): 'new' | 'indeterminate' | 'done' | '' =>
  state === 'done' ? 'done' : state === 'active' ? 'indeterminate' : 'new';

const rawGithubState = (state: StarredIssue['state']): string =>
  state === 'done' ? 'CLOSED' : 'OPEN';

const rawGitlabState = (state: StarredIssue['state']): string =>
  state === 'open' ? 'opened' : state === 'done' ? 'closed' : 'active';

const githubNumberOf = (externalId: string): number => {
  const parsed = parseIssueCode(externalId);
  return parsed.kind === 'slugNumber' ? parsed.number : 0;
};

const gitlabIidOf = (identifier: string): number => {
  const parsed = parseIssueCode(identifier);
  return parsed.kind === 'slugNumber' ? parsed.number : 0;
};

export const placeholderRecordOf = (issue: StarredIssue): InboxRecord | null => {
  const updatedAt = issue.refreshedAt ?? issue.starredAt;
  const state = recordStateOf(issue.state);
  const stateLabel = issue.stateLabel ?? '';
  switch (issue.provider) {
    case 'linear':
      return {
        key: `linear:issue:${issue.externalId}`,
        provider: 'linear',
        kind: 'issue',
        identifier: issue.identifier,
        title: issue.title,
        state,
        stateLabel,
        updatedAt,
        url: issue.url,
        context: issue.container ?? '',
        payload: {
          provider: 'linear',
          kind: 'issue',
          sessionId: null,
          issue: {
            id: issue.externalId,
            identifier: issue.identifier,
            title: issue.title,
            description: null,
            url: issue.url,
            state: { name: stateLabel, type: rawLinearStateType(issue.state) },
            team: { key: issue.container ?? '' },
            priority: null,
            priorityLabel: null,
            assignee: null,
            creator: null,
            project: null,
            labels: { nodes: [] },
            updatedAt,
            branchName: '',
            attachments: { nodes: [] },
          },
        },
      };
    case 'jira':
      return {
        key: `jira:issue:${issue.externalId}`,
        provider: 'jira',
        kind: 'issue',
        identifier: issue.identifier,
        title: issue.title,
        state,
        stateLabel,
        updatedAt,
        url: issue.url,
        context: '',
        payload: {
          provider: 'jira',
          kind: 'issue',
          sessionId: null,
          issue: {
            id: issue.externalId,
            key: issue.identifier,
            summary: issue.title,
            description: '',
            status: stateLabel,
            statusCategory: rawJiraStatusCategory(issue.state),
            issueType: '',
            priority: null,
            assignee: null,
            reporter: null,
            labels: [],
            created: issue.starredAt,
            updated: updatedAt,
            url: issue.url,
          },
        },
      };
    case 'github': {
      const number = githubNumberOf(issue.externalId);
      return {
        key: `github:issue:${issue.externalId}`,
        provider: 'github',
        kind: 'issue',
        identifier: issue.identifier,
        title: issue.title,
        state,
        stateLabel,
        updatedAt,
        url: issue.url,
        context: issue.container?.split('/').at(-1) ?? '',
        payload: {
          provider: 'github',
          kind: 'issue',
          sessionId: null,
          issue: {
            number,
            title: issue.title,
            body: '',
            url: issue.url,
            state: rawGithubState(issue.state),
            labels: [],
            updatedAt,
            author: null,
          },
        },
      };
    }
    case 'gitlab': {
      const iid = gitlabIidOf(issue.identifier);
      return {
        key: `gitlab:issue:${issue.externalId}`,
        provider: 'gitlab',
        kind: 'issue',
        identifier: issue.identifier,
        title: issue.title,
        state,
        stateLabel,
        updatedAt,
        url: issue.url,
        context: issue.container ?? '',
        payload: {
          provider: 'gitlab',
          kind: 'issue',
          sessionId: null,
          issue: {
            id: Number(issue.externalId) || 0,
            iid,
            projectId: 0,
            title: issue.title,
            description: null,
            state: rawGitlabState(issue.state),
            webUrl: issue.url,
            references: { full: issue.identifier },
            updatedAt,
            milestone: null,
            labels: [],
          },
        },
      };
    }
    case 'sentry':
      return {
        key: `sentry:error:${issue.externalId}`,
        provider: 'sentry',
        kind: 'error',
        identifier: issue.identifier,
        title: issue.title,
        state,
        stateLabel,
        updatedAt,
        url: issue.url,
        context: '',
        payload: {
          provider: 'sentry',
          kind: 'error',
          sessionId: null,
          issue: {
            id: issue.externalId,
            project: null,
            shortId: issue.identifier,
            title: issue.title,
            culprit: null,
            level: null,
            status: stateLabel === '' ? null : stateLabel,
            count: null,
            userCount: null,
            firstSeen: null,
            lastSeen: null,
            permalink: issue.url,
            metadata: null,
          },
        },
      };
    case 'slack':
    case 'bitbucket':
      return null;
  }
};
