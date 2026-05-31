import { describe, expect, it } from 'vitest';
import type { Session, SessionExternalTask, SessionId } from '@goodboy/types';
import { buildIssueGroups, resolveIssueSessions, type SessionPrRef } from './useLinearIssues';
import type { LinearAttachment, LinearIssue } from '../client';

function makeIssue(overrides: Partial<LinearIssue> = {}): LinearIssue {
  return {
    id: 'lin-1',
    identifier: 'SER-1',
    title: 'Issue one',
    description: null,
    url: 'https://linear.app/serenis/issue/SER-1',
    state: { name: 'In Progress', type: 'started' },
    team: { key: 'SER' },
    updatedAt: '2026-05-21T10:00:00Z',
    ...overrides,
  };
}

function prAttachment(repo: string, number: number): LinearAttachment {
  return {
    id: `att-${number}`,
    title: null,
    url: `https://github.com/${repo}/pull/${number}`,
    sourceType: 'github',
    metadata: null,
  };
}

function session(id: string): Session {
  return { id: id as SessionId } as Session;
}

describe('buildIssueGroups', () => {
  it('orders groups started → unstarted → backlog → triage and drops empty buckets', () => {
    const issues = [
      makeIssue({ id: 'a', state: { name: 'Backlog', type: 'backlog' } }),
      makeIssue({ id: 'b', state: { name: 'Todo', type: 'unstarted' } }),
      makeIssue({ id: 'c', state: { name: 'In Progress', type: 'started' } }),
    ];
    const groups = buildIssueGroups(issues, new Map());
    expect(groups.map((g) => g.key)).toEqual(['started', 'unstarted', 'backlog']);
    expect(groups.map((g) => g.label)).toEqual(['In Progress', 'Todo', 'Backlog']);
  });

  it('sorts rows within a group newest-first by updatedAt', () => {
    const issues = [
      makeIssue({ id: 'old', updatedAt: '2026-01-01T00:00:00Z' }),
      makeIssue({ id: 'new', updatedAt: '2026-05-01T00:00:00Z' }),
      makeIssue({ id: 'mid', updatedAt: '2026-03-01T00:00:00Z' }),
    ];
    const [group] = buildIssueGroups(issues, new Map());
    expect(group?.rows.map((r) => r.issue.id)).toEqual(['new', 'mid', 'old']);
  });

  it('cross-links a row to an existing session by external id', () => {
    const issues = [makeIssue({ id: 'lin-x' }), makeIssue({ id: 'lin-y' })];
    const map = new Map<string, SessionId>([['lin-x', 'sess-1' as SessionId]]);
    const rows = buildIssueGroups(issues, map).flatMap((g) => g.rows);
    expect(rows.find((r) => r.issue.id === 'lin-x')?.sessionId).toBe('sess-1');
    expect(rows.find((r) => r.issue.id === 'lin-y')?.sessionId).toBeNull();
  });

  it('falls back to the other bucket for unknown state types', () => {
    const groups = buildIssueGroups(
      [makeIssue({ id: 'z', state: { name: 'Weird', type: 'mystery' } })],
      new Map(),
    );
    expect(groups.map((g) => g.key)).toEqual(['other']);
  });
});

describe('resolveIssueSessions', () => {
  const NO_BRANCHES: Record<string, string> = {};
  const NO_TASKS: Record<string, SessionExternalTask> = {};
  const NO_PRS = new Map<string, SessionPrRef>();

  it('links by external task', () => {
    const issue = makeIssue({ id: 'lin-x' });
    const tasks: Record<string, SessionExternalTask> = {
      s1: { externalId: 'lin-x', provider: 'linear' } as SessionExternalTask,
    };
    const map = resolveIssueSessions([issue], [session('s1')], NO_BRANCHES, tasks, NO_PRS);
    expect(map.get('lin-x')).toBe('s1');
  });

  it('links by a shared pull request when no external task exists', () => {
    const issue = makeIssue({
      id: 'lin-x',
      attachments: { nodes: [prAttachment('acme/web', 42)] },
    });
    const prs = new Map<string, SessionPrRef>([['s1', { number: 42, repo: 'acme/web' }]]);
    const map = resolveIssueSessions([issue], [session('s1')], NO_BRANCHES, NO_TASKS, prs);
    expect(map.get('lin-x')).toBe('s1');
  });

  it('does not link a same-numbered PR in a different repo', () => {
    const issue = makeIssue({
      id: 'lin-x',
      attachments: { nodes: [prAttachment('acme/web', 42)] },
    });
    const prs = new Map<string, SessionPrRef>([['s1', { number: 42, repo: 'other/repo' }]]);
    const map = resolveIssueSessions([issue], [session('s1')], NO_BRANCHES, NO_TASKS, prs);
    expect(map.get('lin-x')).toBeUndefined();
  });

  it('links by exact Linear branch name', () => {
    const issue = makeIssue({ id: 'lin-x', branchName: 'amin/ser-1-fix' });
    const branches = { s1: 'amin/ser-1-fix' };
    const map = resolveIssueSessions([issue], [session('s1')], branches, NO_TASKS, NO_PRS);
    expect(map.get('lin-x')).toBe('s1');
  });

  it('prefers the external-task link over a branch match', () => {
    const issue = makeIssue({ id: 'lin-x', branchName: 'amin/ser-1-fix' });
    const tasks: Record<string, SessionExternalTask> = {
      s2: { externalId: 'lin-x', provider: 'linear' } as SessionExternalTask,
    };
    const branches = { s1: 'amin/ser-1-fix' };
    const map = resolveIssueSessions(
      [issue],
      [session('s1'), session('s2')],
      branches,
      tasks,
      NO_PRS,
    );
    expect(map.get('lin-x')).toBe('s2');
  });
});
