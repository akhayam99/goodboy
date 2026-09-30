// @vitest-environment happy-dom

import { isValidElement, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import type { GithubIssue, PullRequestState } from '@goodboy/types';
import type { LinearIssue } from '../../features/integrations/linear/client';
import type { GitlabIssue, GitlabMergeRequest } from '../../features/integrations/gitlab/client';
import { formatDateTime } from '../utils/time/formatDateTime';
import {
  githubIssueFields,
  githubPullRequestFields,
  gitlabIssueFields,
  gitlabMergeRequestFields,
  linearIssueFields,
  resolveFacts,
  sentryIssueFields,
  slackThreadFields,
} from '.';
import type { ResolvedFact } from './factTypes';
import type { SentryIssueProperties } from './sentryIssueFields';

type NodeChildren = {
  readonly children?: ReactNode;
};

const nodeText = (node: ReactNode): string => {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }
  if (isValidElement<NodeChildren>(node)) {
    return nodeText(node.props.children);
  }
  return '';
};

const stateLabel = (node: ReactNode): string | null =>
  isValidElement<{ readonly label?: string }>(node) ? (node.props.label ?? null) : null;

const LINEAR_ISSUE: LinearIssue = {
  id: 'issue-1',
  identifier: 'GB-42',
  title: 'Improve linked issue detail',
  description: null,
  url: 'https://linear.app/goodboy/issue/GB-42',
  state: { name: 'In Progress', type: 'started' },
  team: { key: 'GB' },
  priority: 1,
  priorityLabel: 'Urgent',
  assignee: { name: 'Grace Hopper' },
  project: { name: 'Desktop' },
  labels: { nodes: [{ name: 'UI', color: '#5e6ad2' }] },
  updatedAt: '2026-07-23T10:00:00Z',
};

const SENTRY_ISSUE: SentryIssueProperties = {
  status: 'unresolved',
  level: 'error',
  culprit: 'api/items',
  count: '128',
  userCount: 9,
  lastSeen: '2026-07-23T10:00:00Z',
  tags: [
    { key: 'release', value: 'desktop@1.2.3' },
    { key: 'environment', value: 'production' },
    { key: 'os', value: 'macOS' },
    { key: 'browser', value: 'Safari' },
  ],
};

const GITHUB_ISSUE: GithubIssue = {
  number: 42,
  title: 'Add issue dashboard',
  body: 'body',
  url: 'https://github.com/goodboy/goodboy/issues/42',
  state: 'OPEN',
  labels: ['feature'],
  updatedAt: '2026-07-22T10:00:00Z',
};

const GITHUB_PR: PullRequestState = {
  number: 7,
  title: 'Unify detail anatomy',
  url: 'https://github.com/goodboy/goodboy/pull/7',
  state: 'open',
  mergeable: true,
  checks: 'success',
  baseBranch: 'main',
  headBranch: 'ak/refactor-detail-anatomy',
  isDraft: false,
  reviewDecision: null,
  body: 'body',
  updatedAt: '2026-07-22T10:00:00Z',
};

const GITLAB_ISSUE: GitlabIssue = {
  id: 1,
  iid: 12,
  projectId: 3,
  title: 'Fix the importer',
  description: null,
  state: 'opened',
  webUrl: 'https://gitlab.com/acme/web/-/issues/12',
  references: { full: 'acme/web#12' },
  updatedAt: '2026-07-22T10:00:00Z',
  milestone: { title: 'v1.3' },
  labels: ['bug'],
};

const GITLAB_MR: GitlabMergeRequest = {
  id: 1,
  iid: 4,
  projectId: 3,
  title: 'Fix the importer',
  description: null,
  state: 'opened',
  webUrl: 'https://gitlab.com/acme/web/-/merge_requests/4',
  sourceBranch: 'ak/fix-importer',
  targetBranch: 'main',
  draft: false,
  hasConflicts: false,
  mergeStatus: 'can_be_merged',
  updatedAt: '2026-07-22T10:00:00Z',
};

const factText = (facts: ReadonlyArray<ResolvedFact>): Record<string, string> =>
  Object.fromEntries(facts.map((fact) => [fact.key, nodeText(fact.node)]));

describe('fact registries', () => {
  it('resolves every tool in the canonical slot order', () => {
    const slotsOf = (facts: ReadonlyArray<ResolvedFact>) => facts.map((fact) => fact.slot);

    expect(slotsOf(resolveFacts({ registry: linearIssueFields, entity: LINEAR_ISSUE }))).toEqual([
      'state',
      'weight',
      'person',
      'place',
      'labels',
    ]);
    expect(slotsOf(resolveFacts({ registry: sentryIssueFields, entity: SENTRY_ISSUE }))).toEqual([
      'state',
      'weight',
      'place',
      'labels',
      'labels',
      'labels',
      'measure',
    ]);
    expect(slotsOf(resolveFacts({ registry: githubIssueFields, entity: GITHUB_ISSUE }))).toEqual([
      'state',
      'place',
      'labels',
    ]);
    expect(slotsOf(resolveFacts({ registry: gitlabIssueFields, entity: GITLAB_ISSUE }))).toEqual([
      'place',
      'labels',
      'time',
    ]);
    expect(
      slotsOf(
        resolveFacts({
          registry: gitlabMergeRequestFields,
          entity: { mr: GITLAB_MR, approval: null },
        }),
      ),
    ).toEqual(['place', 'time']);
  });

  it('writes each fact once, in the words of the tool', () => {
    const linear = factText(resolveFacts({ registry: linearIssueFields, entity: LINEAR_ISSUE }));
    expect(linear.assignee).toBe('Grace Hopper');
    expect(linear.place).toBe('GB › Desktop');

    const sentry = factText(resolveFacts({ registry: sentryIssueFields, entity: SENTRY_ISSUE }));
    expect(sentry.events).toBe('128 events · 9 users');
    expect(sentry.culprit).toBe('api/items');

    const gitlab = factText(resolveFacts({ registry: gitlabIssueFields, entity: GITLAB_ISSUE }));
    expect(gitlab.place).toBe('acme/web › v1.3');

    const mr = factText(
      resolveFacts({
        registry: gitlabMergeRequestFields,
        entity: {
          mr: GITLAB_MR,
          approval: {
            approvalsRequired: 2,
            approvalsLeft: 1,
            userHasApproved: false,
            userCanApprove: true,
            approvedBy: [],
          },
        },
      }),
    );
    expect(mr.branches).toBe('ak/fix-importer → main');
    expect(mr.approvals).toBe('1 of 2 approvals');
  });

  it('never repeats the slack channel the identifier already names', () => {
    expect(slackThreadFields.place).toBeUndefined();
  });

  it('keeps at most three sentry tags', () => {
    const tags = resolveFacts({ registry: sentryIssueFields, entity: SENTRY_ISSUE }).filter(
      (fact) => fact.slot === 'labels',
    );

    expect(tags.map((fact) => nodeText(fact.node))).toEqual([
      'release: desktop@1.2.3',
      'environment: production',
      'os: macOS',
    ]);
  });

  it('shows time as a relative age with the absolute date in the hint', () => {
    const [time] = resolveFacts({ registry: gitlabIssueFields, entity: GITLAB_ISSUE }).filter(
      (fact) => fact.slot === 'time',
    );

    expect(time?.hint).toBe(
      `Updated ${formatDateTime({ at: GITLAB_ISSUE.updatedAt, hasYear: true })}`,
    );
  });

  it('leaves no empty pill for a fact the payload does not carry', () => {
    const sparse = resolveFacts({
      registry: linearIssueFields,
      entity: {
        ...LINEAR_ISSUE,
        assignee: null,
        priority: 0,
        project: null,
        labels: { nodes: [] },
        updatedAt: 'not-a-date',
      },
    });

    expect(sparse.map((fact) => fact.key)).toEqual(['state', 'place']);
  });
});

describe('the pull request registry', () => {
  const checks = [
    { name: 'typecheck', conclusion: 'success' as const, detailsUrl: null, durationMs: 1 },
    { name: 'unit', conclusion: 'failure' as const, detailsUrl: null, durationMs: 1 },
  ];

  it('reads status, review, branch and checks as label and value rows', () => {
    const facts = resolveFacts({
      registry: githubPullRequestFields,
      entity: { pr: { ...GITHUB_PR, reviewDecision: 'changes_requested' }, checks },
    });

    expect(facts.map((fact) => fact.label)).toEqual(['Status', 'Review', 'Branch', 'Checks']);
    expect(stateLabel(facts[0]?.node)).toBe('In review');
    expect(facts.slice(1).map((fact) => nodeText(fact.node))).toEqual([
      'Changes requested',
      'ak/refactor-detail-anatomy › main',
      '1 of 2 passing',
    ]);
  });

  it('says draft for a draft and leaves out what is not known yet', () => {
    const facts = resolveFacts({
      registry: githubPullRequestFields,
      entity: { pr: { ...GITHUB_PR, isDraft: true }, checks: [] },
    });

    expect(facts.map((fact) => fact.label)).toEqual(['Status', 'Branch']);
    expect(stateLabel(facts[0]?.node)).toBe('Draft');
  });
});
