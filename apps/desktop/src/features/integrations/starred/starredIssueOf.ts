import type { IsoDateTime, StarredIssue, WorkspaceId } from '@goodboy/types';
import type { LaunchExternalTask } from '../../inbox/launchSpecFor';
import type { InboxRecord } from '../../inbox/types';
import { parseIssueCode } from '../issueCode/parseIssueCode';
import type { LookupTarget } from '../issueCode/routeIssueCode';

type Identity = Pick<StarredIssue, 'provider' | 'externalId' | 'container'>;

const githubRepoOf = (url: string): string | null =>
  /github\.com\/([^/]+\/[^/]+)/.exec(url)?.[1] ?? null;

export const starIdentityOf = (record: InboxRecord): Identity | null => {
  const { payload } = record;
  switch (payload.provider) {
    case 'linear':
      return payload.kind === 'issue'
        ? { provider: 'linear', externalId: payload.issue.id, container: null }
        : null;
    case 'jira':
      return { provider: 'jira', externalId: payload.issue.id, container: null };
    case 'sentry':
      return { provider: 'sentry', externalId: payload.issue.id, container: null };
    case 'github': {
      if (payload.kind !== 'issue') {
        return null;
      }
      const repo = githubRepoOf(payload.issue.url);
      return repo === null
        ? null
        : { provider: 'github', externalId: `${repo}#${payload.issue.number}`, container: repo };
    }
    case 'gitlab': {
      if (payload.kind !== 'issue') {
        return null;
      }
      const full = payload.issue.references.full;
      const container = full.includes('#') ? full.slice(0, full.lastIndexOf('#')) : null;
      return { provider: 'gitlab', externalId: String(payload.issue.id), container };
    }
    case 'slack':
    case 'bitbucket':
      return null;
  }
};

const GITHUB_ISSUE_URL = /github\.com\/([^/]+\/[^/]+)\/issues\/(\d+)/;

type TaskParams = {
  readonly task: LaunchExternalTask;
};

const ISSUE_MARK = '/-/issues/';

const gitlabContainerOf = ({ task }: TaskParams): string | null => {
  const mark = task.url.indexOf(ISSUE_MARK);
  if (mark < 0) {
    return null;
  }
  const afterScheme = task.url.indexOf('://') + 3;
  const pathStart = task.url.indexOf('/', afterScheme);
  if (afterScheme < 3 || pathStart < 0 || pathStart >= mark) {
    return null;
  }
  return task.url.slice(pathStart + 1, mark);
};

export const starIdentityOfTask = ({ task }: TaskParams): Identity | null => {
  switch (task.provider) {
    case 'linear':
    case 'jira':
    case 'sentry':
      return { provider: task.provider, externalId: task.externalId, container: null };
    case 'github': {
      const match = GITHUB_ISSUE_URL.exec(task.url);
      if (match?.[1] === undefined || match[2] === undefined) {
        return null;
      }
      return { provider: 'github', externalId: `${match[1]}#${match[2]}`, container: match[1] };
    }
    case 'gitlab': {
      const container = gitlabContainerOf({ task });
      if (container === null) {
        return null;
      }
      return { provider: 'gitlab', externalId: task.externalId, container };
    }
    case 'slack':
    case 'bitbucket':
      return null;
  }
};

export const starKey = ({ provider, externalId }: Pick<StarredIssue, 'provider' | 'externalId'>) =>
  `${provider}:${externalId}`;

export const starredIssueOf = ({
  workspaceId,
  record,
  now,
}: {
  readonly workspaceId: WorkspaceId;
  readonly record: InboxRecord;
  readonly now: IsoDateTime;
}): StarredIssue | null => {
  const identity = starIdentityOf(record);
  if (identity === null) {
    return null;
  }
  return {
    workspaceId,
    ...identity,
    identifier: record.identifier,
    title: record.title,
    url: record.url,
    state: record.state,
    stateLabel: record.stateLabel,
    starredAt: now,
    refreshedAt: now,
  };
};

type StarTaskParams = TaskParams & {
  readonly workspaceId: WorkspaceId;
  readonly now: IsoDateTime;
};

export const starredIssueOfTask = ({
  workspaceId,
  task,
  now,
}: StarTaskParams): StarredIssue | null => {
  const identity = starIdentityOfTask({ task });
  if (identity === null) {
    return null;
  }
  return {
    workspaceId,
    ...identity,
    identifier: task.identifier,
    title: task.title,
    url: task.url,
    state: 'open',
    stateLabel: null,
    starredAt: now,
    refreshedAt: null,
  };
};

export const lookupTargetOf = (issue: StarredIssue): LookupTarget | null => {
  switch (issue.provider) {
    case 'linear':
      return { provider: 'linear', identifier: issue.identifier };
    case 'jira':
      return { provider: 'jira', key: issue.identifier };
    case 'sentry':
      return { provider: 'sentry-id', issueId: issue.externalId };
    case 'github': {
      const parsed = parseIssueCode(issue.externalId);
      return parsed.kind === 'slugNumber'
        ? { provider: 'github', repo: parsed.slug, number: parsed.number }
        : null;
    }
    case 'gitlab': {
      const parsed = parseIssueCode(issue.identifier);
      return parsed.kind === 'slugNumber'
        ? { provider: 'gitlab', projectPath: parsed.slug, iid: parsed.number }
        : null;
    }
    case 'slack':
    case 'bitbucket':
      return null;
  }
};
