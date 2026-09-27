import type { IsoDateTime, SessionId, StarredIssue } from '@goodboy/types';
import type { InboxRecord } from '../../inbox/types';
import { adaptGitlab } from '../../inbox/adapters/gitlab';
import { adaptJiraIssues } from '../../inbox/adapters/jira';
import { adaptLinearIssues } from '../../inbox/adapters/linear';
import { gitlabFetchIssues } from '../gitlab/client';
import { lookupIssueByCode, type LookupDeps } from '../issueCode/lookupIssueByCode';
import type { LookupTarget } from '../issueCode/routeIssueCode';
import { jiraGetIssues } from '../jira/client';
import { buildIssueGroups as buildJiraGroups } from '../jira/JiraStudio/useJiraIssues';
import { linearFetchIssuesByIds } from '../linear/client';
import { buildIssueGroups as buildLinearGroups } from '../linear/LinearStudio/useLinearIssues';
import { lookupTargetOf, starKey } from './starredIssueOf';

export type StarredRefresh = {
  readonly snapshots: ReadonlyArray<StarredIssue>;
  readonly records: Readonly<Record<string, InboxRecord>>;
};

const EMPTY_SESSIONS: ReadonlyMap<string, SessionId> = new Map();

type Paired = { readonly issue: StarredIssue; readonly target: LookupTarget };

const isLinearTarget = (
  pair: Paired,
): pair is Paired & { readonly target: Extract<LookupTarget, { readonly provider: 'linear' }> } =>
  pair.target.provider === 'linear';

const isJiraTarget = (
  pair: Paired,
): pair is Paired & { readonly target: Extract<LookupTarget, { readonly provider: 'jira' }> } =>
  pair.target.provider === 'jira';

const isGitlabTarget = (
  pair: Paired,
): pair is Paired & { readonly target: Extract<LookupTarget, { readonly provider: 'gitlab' }> } =>
  pair.target.provider === 'gitlab';

const isBatchedTarget = (pair: Paired): boolean =>
  isLinearTarget(pair) || isJiraTarget(pair) || isGitlabTarget(pair);

type Outcome = {
  readonly records: Record<string, InboxRecord>;
  readonly reached: Set<string>;
  readonly found: Set<string>;
};

const markReached = (
  outcome: Outcome,
  issue: StarredIssue,
  record: InboxRecord | undefined,
): void => {
  const key = starKey(issue);
  outcome.reached.add(key);
  if (record !== undefined) {
    outcome.records[key] = record;
    outcome.found.add(key);
  }
};

const refreshLinear = async (
  outcome: Outcome,
  paired: ReadonlyArray<Paired>,
  workspaceId: LookupDeps['workspaceId'],
): Promise<void> => {
  const linearPaired = paired.filter(isLinearTarget);
  if (linearPaired.length === 0) {
    return;
  }
  const issues = await linearFetchIssuesByIds({
    workspaceId,
    issueIds: linearPaired.map((pair) => pair.issue.externalId),
  }).catch(() => null);
  if (issues === null) {
    return;
  }
  const records = adaptLinearIssues({ groups: buildLinearGroups(issues, EMPTY_SESSIONS) });
  const byIdentifier = new Map(records.map((record) => [record.identifier, record]));
  for (const pair of linearPaired) {
    markReached(outcome, pair.issue, byIdentifier.get(pair.target.identifier));
  }
};

const refreshJira = async (
  outcome: Outcome,
  paired: ReadonlyArray<Paired>,
  deps: LookupDeps,
): Promise<void> => {
  const jiraPaired = paired.filter(isJiraTarget);
  const jiraConfig = deps.jiraConfig;
  if (jiraPaired.length === 0 || jiraConfig === null) {
    return;
  }
  const issues = await jiraGetIssues({
    workspaceId: deps.workspaceId,
    siteUrl: jiraConfig.siteUrl,
    email: jiraConfig.email,
    issueKeys: jiraPaired.map((pair) => pair.target.key),
  }).catch(() => null);
  if (issues === null) {
    return;
  }
  const records = adaptJiraIssues({
    groups: buildJiraGroups({ issues, sessionIdByExternalId: EMPTY_SESSIONS }),
  });
  const byIdentifier = new Map(records.map((record) => [record.identifier, record]));
  for (const pair of jiraPaired) {
    markReached(outcome, pair.issue, byIdentifier.get(pair.target.key));
  }
};

const refreshGitlab = async (
  outcome: Outcome,
  paired: ReadonlyArray<Paired>,
  deps: LookupDeps,
): Promise<void> => {
  const gitlabPaired = paired.filter(isGitlabTarget);
  const gitlabHost = deps.gitlabHost;
  if (gitlabPaired.length === 0 || gitlabHost === null) {
    return;
  }
  const byProject = new Map<string, typeof gitlabPaired>();
  for (const pair of gitlabPaired) {
    const projectPath = pair.target.projectPath;
    const list = byProject.get(projectPath) ?? [];
    list.push(pair);
    byProject.set(projectPath, list);
  }
  await Promise.all(
    [...byProject.entries()].map(async ([projectPath, projectPaired]) => {
      const issues = await gitlabFetchIssues({
        workspaceId: deps.workspaceId,
        host: gitlabHost,
        projectPath,
        issueIids: projectPaired.map((pair) => pair.target.iid),
      }).catch(() => null);
      if (issues === null) {
        return;
      }
      const records = adaptGitlab({
        issueGroups: [
          {
            key: projectPath,
            label: projectPath,
            rows: issues.map((issue) => ({ issue, sessionId: null })),
          },
        ],
        mrGroups: [],
        host: gitlabHost,
      });
      const byIid = new Map<number, InboxRecord>();
      issues.forEach((issue, index) => {
        const record = records[index];
        if (record !== undefined) {
          byIid.set(issue.iid, record);
        }
      });
      for (const pair of projectPaired) {
        markReached(outcome, pair.issue, byIid.get(pair.target.iid));
      }
    }),
  );
};

const sameTarget = (left: LookupTarget, right: LookupTarget): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

const refreshPerIssue = async (
  outcome: Outcome,
  paired: ReadonlyArray<Paired>,
  deps: LookupDeps,
): Promise<void> => {
  if (paired.length === 0) {
    return;
  }
  const result = await lookupIssueByCode({ ...deps, targets: paired.map((pair) => pair.target) });
  for (const pair of paired) {
    const hit = result.hits.find((candidate) => sameTarget(candidate.target, pair.target));
    if (hit !== undefined) {
      markReached(outcome, pair.issue, hit.record);
      continue;
    }
    const miss = result.misses.find((candidate) => sameTarget(candidate.target, pair.target));
    if (miss?.failure === 'not-found') {
      markReached(outcome, pair.issue, undefined);
    }
  }
};

type Params = LookupDeps & {
  readonly issues: ReadonlyArray<StarredIssue>;
  readonly now: IsoDateTime;
};

export const refreshStarredIssues = async ({
  issues,
  now,
  ...deps
}: Params): Promise<StarredRefresh> => {
  const paired = issues.flatMap((issue) => {
    const target = lookupTargetOf(issue);
    return target === null ? [] : [{ issue, target }];
  });
  const perIssue = paired.filter((pair) => !isBatchedTarget(pair));

  const outcome: Outcome = { records: {}, reached: new Set(), found: new Set() };
  await Promise.all([
    refreshLinear(outcome, paired, deps.workspaceId),
    refreshJira(outcome, paired, deps),
    refreshGitlab(outcome, paired, deps),
    refreshPerIssue(outcome, perIssue, deps),
  ]);

  const snapshots: StarredIssue[] = [];
  for (const { issue } of paired) {
    const key = starKey(issue);
    const record = outcome.records[key];
    if (outcome.found.has(key) && record !== undefined) {
      snapshots.push({
        ...issue,
        identifier: record.identifier,
        title: record.title,
        url: record.url,
        state: record.state,
        stateLabel: record.stateLabel,
        refreshedAt: now,
      });
      continue;
    }
    if (outcome.reached.has(key)) {
      snapshots.push({ ...issue, state: 'missing', refreshedAt: now });
    }
  }
  return { snapshots, records: outcome.records };
};
