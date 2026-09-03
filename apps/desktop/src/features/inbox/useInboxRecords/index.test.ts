import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceId } from '@goodboy/types';
import type { GithubIssueGroup } from '../../github/components/GitHubStudio/useGithubIssues';
import type { GitlabIssueGroup } from '../../integrations/gitlab/GitlabStudio/useGitlabIssues';
import type { GitlabMrGroup } from '../../integrations/gitlab/GitlabStudio/useGitlabMrs';
import type { JiraIssueGroup } from '../../integrations/jira/JiraStudio/useJiraIssues';
import type { LinearIssueGroup } from '../../integrations/linear/LinearStudio/useLinearIssues';
import type { SentryIssueRow } from '../../integrations/sentry/SentryStudio/useSentryIssues';
import type { SlackThreadGroup } from '../../integrations/slack/SlackStudio/useSlackThreads';
import type { BitbucketPrGroup } from '../../integrations/bitbucket/BitbucketStudio/useBitbucketPrs';
import type { BitbucketRepo } from '../../integrations/bitbucket/client';

const h = vi.hoisted(() => ({
  integrations: {} as Record<string, ReadonlyArray<{ provider: string }>>,
  github: { groups: [] as GithubIssueGroup[], loading: false, error: null as string | null },
  gitlabIssues: { groups: [] as GitlabIssueGroup[], loading: false, error: null as string | null },
  gitlabMrs: {
    groups: [] as GitlabMrGroup[],
    host: null as string | null,
    loading: false,
    error: null as string | null,
  },
  linear: { groups: [] as LinearIssueGroup[], loading: false, error: null as string | null },
  jira: { groups: [] as JiraIssueGroup[], isLoading: false, error: null as string | null },
  sentry: { rows: [] as SentryIssueRow[], loading: false, error: null as string | null },
  slack: { groups: [] as SlackThreadGroup[], isLoading: false, error: null as string | null },
  bitbucketRepo: null as BitbucketRepo | null,
  bitbucket: { groups: [] as BitbucketPrGroup[], loading: false, error: null as string | null },
  refetch: {
    github: vi.fn(),
    gitlabIssues: vi.fn(),
    gitlabMrs: vi.fn(),
    linear: vi.fn(),
    jira: vi.fn(),
    sentry: vi.fn(),
    slack: vi.fn(),
    bitbucket: vi.fn(),
  },
  enabled: {} as Record<string, boolean>,
}));

vi.mock('../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T>(selector: (state: { workspaceIntegrations: typeof h.integrations }) => T) =>
    selector({ workspaceIntegrations: h.integrations }),
}));

vi.mock('../../github/components/GitHubStudio/useGithubIssues', () => ({
  useGithubIssues: (params: { isEnabled: boolean }) => {
    h.enabled.github = params.isEnabled;
    return { ...h.github, refetch: h.refetch.github };
  },
}));

vi.mock('../../integrations/gitlab/GitlabStudio/useGitlabIssues', () => ({
  useGitlabIssues: (params: { isEnabled: boolean }) => {
    h.enabled.gitlab = params.isEnabled;
    return { ...h.gitlabIssues, refetch: h.refetch.gitlabIssues };
  },
}));

vi.mock('../../integrations/gitlab/GitlabStudio/useGitlabMrs', () => ({
  useGitlabMrs: (params: { isEnabled: boolean }) => {
    h.enabled.gitlabMrs = params.isEnabled;
    return { ...h.gitlabMrs, refetch: h.refetch.gitlabMrs };
  },
}));

vi.mock('../../integrations/jira/JiraStudio/useJiraIssues', () => ({
  useJiraIssues: (params: { isEnabled: boolean }) => {
    h.enabled.jira = params.isEnabled;
    return { ...h.jira, refetch: h.refetch.jira };
  },
}));

vi.mock('../../integrations/linear/LinearStudio/useLinearIssues', () => ({
  useLinearIssues: (workspaceId: WorkspaceId, isEnabled: boolean) => {
    h.enabled.linear = isEnabled;
    return { ...h.linear, refetch: h.refetch.linear };
  },
}));

vi.mock('../../integrations/sentry/SentryStudio/useSentryIssues', () => ({
  useSentryIssues: (workspaceId: WorkspaceId, isEnabled: boolean) => {
    h.enabled.sentry = isEnabled;
    return { ...h.sentry, refetch: h.refetch.sentry };
  },
}));

vi.mock('../../integrations/slack/SlackStudio/useSlackThreads', () => ({
  useSlackThreads: (params: { isEnabled: boolean }) => {
    h.enabled.slack = params.isEnabled;
    return { ...h.slack, refetch: h.refetch.slack };
  },
}));

vi.mock('../../integrations/bitbucket/useWorkspaceBitbucketRepo', () => ({
  useWorkspaceBitbucketRepo: (params: { isEnabled: boolean }) => {
    h.enabled.bitbucket = params.isEnabled;
    return h.bitbucketRepo;
  },
}));

vi.mock('../../integrations/bitbucket/BitbucketStudio/useBitbucketPrs', () => ({
  useBitbucketPrs: () => ({ ...h.bitbucket, refetch: h.refetch.bitbucket }),
}));

const { useInboxRecords } = await import('./index');

const workspaceId = 'workspace-1' as WorkspaceId;

const githubGroups = (updatedAt: string): GithubIssueGroup[] => [
  {
    key: 'open',
    label: 'Open',
    rows: [
      {
        issue: {
          number: 1,
          title: 'github item',
          body: '',
          url: 'https://github.com/goodboy/goodboy/issues/1',
          state: 'OPEN',
          labels: [],
          updatedAt,
        },
        sessionId: null,
      },
    ],
  },
];

const jiraGroups = (updatedAt: string): JiraIssueGroup[] => [
  {
    key: 'new',
    label: 'To do',
    rows: [
      {
        issue: {
          id: 'jira-1',
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
          created: updatedAt,
          updated: updatedAt,
          url: 'https://goodboy.atlassian.net/browse/GBY-1',
        },
        sessionId: null,
      },
    ],
  },
];

beforeEach(() => {
  h.integrations = {};
  h.github = { groups: [], loading: false, error: null };
  h.gitlabIssues = { groups: [], loading: false, error: null };
  h.gitlabMrs = { groups: [], host: null, loading: false, error: null };
  h.linear = { groups: [], loading: false, error: null };
  h.jira = { groups: [], isLoading: false, error: null };
  h.sentry = { rows: [], loading: false, error: null };
  h.slack = { groups: [], isLoading: false, error: null };
  h.bitbucketRepo = null;
  h.bitbucket = { groups: [], loading: false, error: null };
  h.enabled = {};
  for (const spy of Object.values(h.refetch)) {
    spy.mockReset();
  }
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('useInboxRecords', () => {
  it('aggregates and sorts records newest first across providers', () => {
    h.github = { groups: githubGroups('2026-08-01T10:00:00Z'), loading: false, error: null };
    h.jira = { groups: jiraGroups('2026-08-03T10:00:00Z'), isLoading: false, error: null };

    const { result } = renderHook(() => useInboxRecords({ workspaceId, rootPath: '/repo' }));

    expect(result.current.records.map((record) => record.provider)).toEqual(['jira', 'github']);
  });

  it('keeps github enabled without a workspace integration and gates the rest on it', () => {
    h.integrations = { 'workspace-1': [{ provider: 'linear' }] };

    renderHook(() => useInboxRecords({ workspaceId, rootPath: '/repo' }));

    expect(h.enabled.github).toBe(true);
    expect(h.enabled.linear).toBe(true);
    expect(h.enabled.jira).toBe(false);
    expect(h.enabled.gitlab).toBe(false);
    expect(h.enabled.gitlabMrs).toBe(false);
    expect(h.enabled.sentry).toBe(false);
    expect(h.enabled.slack).toBe(false);
    expect(h.enabled.bitbucket).toBe(false);
  });

  it('isolates a failing provider so the rest of the inbox still renders', () => {
    h.github = { groups: githubGroups('2026-08-01T10:00:00Z'), loading: false, error: null };
    h.jira = { groups: [], isLoading: false, error: 'Jira request failed' };

    const { result } = renderHook(() => useInboxRecords({ workspaceId, rootPath: '/repo' }));

    expect(result.current.records).toHaveLength(1);
    expect(result.current.records[0]?.provider).toBe('github');
    expect(result.current.errors.jira).toBe('Jira request failed');
    expect(result.current.errors.github).toBeNull();
  });

  it('fans refetch out to every underlying provider hook', () => {
    const { result } = renderHook(() => useInboxRecords({ workspaceId, rootPath: '/repo' }));

    result.current.refetch();

    expect(h.refetch.github).toHaveBeenCalledOnce();
    expect(h.refetch.gitlabIssues).toHaveBeenCalledOnce();
    expect(h.refetch.gitlabMrs).toHaveBeenCalledOnce();
    expect(h.refetch.linear).toHaveBeenCalledOnce();
    expect(h.refetch.jira).toHaveBeenCalledOnce();
    expect(h.refetch.sentry).toHaveBeenCalledOnce();
    expect(h.refetch.slack).toHaveBeenCalledOnce();
    expect(h.refetch.bitbucket).toHaveBeenCalledOnce();
  });

  it('reports loading while any provider is still loading', () => {
    h.sentry = { rows: [], loading: true, error: null };

    const { result } = renderHook(() => useInboxRecords({ workspaceId, rootPath: '/repo' }));

    expect(result.current.isLoading).toBe(true);
  });
});
