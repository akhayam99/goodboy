import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session, SessionExternalTask, SessionId, WorkspaceId } from '@goodboy/types';
import {
  buildIssueGroups,
  gitlabBranchSlug,
  projectPathFromIssue,
  resolveIssueSessions,
  useGitlabIssues,
} from './useGitlabIssues';
import { gitlabFetchAssignedIssues, type GitlabIssue } from '../client';

const h = vi.hoisted(() => ({
  sessionExternalTasks: {},
  sessionBranches: {},
  workspaceIntegrations: {
    'workspace-1': [{ provider: 'gitlab', config: { host: 'https://gitlab.com' } }],
  },
}));

vi.mock('../client', () => ({
  gitlabFetchAssignedIssues: vi.fn(),
}));

vi.mock('../../../../store', () => ({
  useSessions: () => [],
  useAppStore: <T>(
    selector: (state: {
      sessionExternalTasks: typeof h.sessionExternalTasks;
      sessionBranches: typeof h.sessionBranches;
      workspaceIntegrations: typeof h.workspaceIntegrations;
    }) => T,
  ) => selector(h),
}));

const fetchAssignedIssues = vi.mocked(gitlabFetchAssignedIssues);

function makeIssue(overrides: Partial<GitlabIssue> = {}): GitlabIssue {
  return {
    id: 101,
    iid: 1,
    projectId: 3,
    title: 'Issue one',
    description: null,
    state: 'opened',
    webUrl: 'https://gitlab.com/acme/web/-/issues/1',
    references: { full: 'acme/web#1' },
    updatedAt: '2026-05-21T10:00:00Z',
    milestone: null,
    labels: [],
    ...overrides,
  };
}

function session(id: string): Session {
  return { id: id as SessionId } as Session;
}

beforeEach(() => {
  fetchAssignedIssues.mockReset();
});

afterEach(cleanup);

describe('projectPathFromIssue', () => {
  it('returns the namespace before the #iid', () => {
    expect(projectPathFromIssue(makeIssue({ references: { full: 'group/sub/proj#42' } }))).toBe(
      'group/sub/proj',
    );
  });

  it('falls back to a default label when the reference is empty', () => {
    expect(projectPathFromIssue(makeIssue({ references: { full: '' } }))).toBe('issues');
  });
});

describe('gitlabBranchSlug', () => {
  it('combines iid with a slugified title', () => {
    expect(gitlabBranchSlug(makeIssue({ iid: 42, title: 'Fix the Login Bug!' }))).toBe(
      '42-fix-the-login-bug',
    );
  });
});

describe('buildIssueGroups', () => {
  it('groups by project path sorted alphabetically', () => {
    const issues = [
      makeIssue({ id: 1, references: { full: 'b/proj#1' } }),
      makeIssue({ id: 2, references: { full: 'a/proj#2' } }),
    ];
    const groups = buildIssueGroups(issues, new Map());
    expect(groups.map((g) => g.key)).toEqual(['a/proj', 'b/proj']);
  });

  it('sorts rows within a group newest-first by updatedAt', () => {
    const issues = [
      makeIssue({ id: 1, updatedAt: '2026-01-01T00:00:00Z' }),
      makeIssue({ id: 2, updatedAt: '2026-05-01T00:00:00Z' }),
      makeIssue({ id: 3, updatedAt: '2026-03-01T00:00:00Z' }),
    ];
    const [group] = buildIssueGroups(issues, new Map());
    expect(group?.rows.map((r) => r.issue.id)).toEqual([2, 3, 1]);
  });

  it('cross-links a row to an existing session by external id', () => {
    const issues = [makeIssue({ id: 7 }), makeIssue({ id: 8 })];
    const map = new Map<string, SessionId>([['7', 'sess-1' as SessionId]]);
    const rows = buildIssueGroups(issues, map).flatMap((g) => g.rows);
    expect(rows.find((r) => r.issue.id === 7)?.sessionId).toBe('sess-1');
    expect(rows.find((r) => r.issue.id === 8)?.sessionId).toBeNull();
  });
});

describe('resolveIssueSessions', () => {
  const NO_BRANCHES: Record<string, string> = {};
  const NO_TASKS: Record<string, ReadonlyArray<SessionExternalTask>> = {};

  it('links by gitlab external task', () => {
    const issue = makeIssue({ id: 101 });
    const tasks: Record<string, ReadonlyArray<SessionExternalTask>> = {
      s1: [{ externalId: '101', provider: 'gitlab' } as SessionExternalTask],
    };
    const map = resolveIssueSessions([issue], [session('s1')], NO_BRANCHES, tasks);
    expect(map.get('101')).toBe('s1');
  });

  it('ignores tasks from other providers', () => {
    const issue = makeIssue({ id: 101 });
    const tasks: Record<string, ReadonlyArray<SessionExternalTask>> = {
      s1: [{ externalId: '101', provider: 'linear' } as SessionExternalTask],
    };
    const map = resolveIssueSessions([issue], [session('s1')], NO_BRANCHES, tasks);
    expect(map.get('101')).toBeUndefined();
  });

  it('links by branch slug when no external task exists', () => {
    const issue = makeIssue({ id: 101, iid: 42, title: 'Fix login' });
    const branches = { s1: 'kay/42-fix-login' };
    const map = resolveIssueSessions([issue], [session('s1')], branches, NO_TASKS);
    expect(map.get('101')).toBe('s1');
  });

  it('does not link a branch whose tail differs from the slug', () => {
    const issue = makeIssue({ id: 101, iid: 42, title: 'Fix login' });
    const branches = { s1: 'kay/99-other' };
    const map = resolveIssueSessions([issue], [session('s1')], branches, NO_TASKS);
    expect(map.get('101')).toBeUndefined();
  });

  it('prefers the external-task link over a branch match', () => {
    const issue = makeIssue({ id: 101, iid: 42, title: 'Fix login' });
    const tasks: Record<string, ReadonlyArray<SessionExternalTask>> = {
      s2: [{ externalId: '101', provider: 'gitlab' } as SessionExternalTask],
    };
    const branches = { s1: 'kay/42-fix-login' };
    const map = resolveIssueSessions([issue], [session('s1'), session('s2')], branches, tasks);
    expect(map.get('101')).toBe('s2');
  });
});

describe('useGitlabIssues', () => {
  it('does not fetch assigned issues when disabled', () => {
    const { result } = renderHook(() =>
      useGitlabIssues({ workspaceId: 'workspace-1' as WorkspaceId, isEnabled: false }),
    );

    expect(result.current.loading).toBe(false);
    expect(result.current.groups).toEqual([]);
    expect(fetchAssignedIssues).not.toHaveBeenCalled();
  });
});
