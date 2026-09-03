import { describe, expect, it } from 'vitest';
import type { SessionId } from '@goodboy/types';
import type { LinearIssue } from '../../integrations/linear/client';
import type { LinearIssueGroup } from '../../integrations/linear/LinearStudio/useLinearIssues';
import { adaptLinearIssues } from './linear';

const issue = (overrides: Partial<LinearIssue> = {}): LinearIssue => ({
  id: 'issue-1',
  identifier: 'ENG-42',
  title: 'Wire the inbox studio',
  description: null,
  url: 'https://linear.app/goodboy/issue/ENG-42',
  state: { name: 'In Progress', type: 'started' },
  team: { key: 'ENG' },
  project: { name: 'Inbox' },
  updatedAt: '2026-08-01T10:00:00Z',
  ...overrides,
});

describe('adaptLinearIssues', () => {
  it('maps an issue row into a normalized inbox record', () => {
    const sessionId = 'session-1' as SessionId;
    const groups: ReadonlyArray<LinearIssueGroup> = [
      { key: 'started', label: 'In Progress', rows: [{ issue: issue(), sessionId }] },
    ];

    const [record] = adaptLinearIssues({ groups });

    expect(record).toEqual({
      key: 'linear:issue:issue-1',
      provider: 'linear',
      kind: 'issue',
      identifier: 'ENG-42',
      title: 'Wire the inbox studio',
      state: 'active',
      updatedAt: '2026-08-01T10:00:00Z',
      url: 'https://linear.app/goodboy/issue/ENG-42',
      meta: 'Inbox',
      payload: { provider: 'linear', kind: 'issue', issue: issue(), sessionId },
    });
  });

  it('falls back to the team key when no project is set', () => {
    const groups: ReadonlyArray<LinearIssueGroup> = [
      {
        key: 'started',
        label: 'In Progress',
        rows: [{ issue: issue({ project: null }), sessionId: null }],
      },
    ];

    const [record] = adaptLinearIssues({ groups });

    expect(record?.meta).toBe('ENG');
  });

  it.each([
    ['completed', 'done'],
    ['canceled', 'done'],
    ['started', 'active'],
    ['unstarted', 'open'],
    ['backlog', 'open'],
    ['triage', 'open'],
  ] as const)('normalizes state type %s to %s', (type, expected) => {
    const groups: ReadonlyArray<LinearIssueGroup> = [
      {
        key: 'other',
        label: 'g',
        rows: [{ issue: issue({ state: { name: type, type } }), sessionId: null }],
      },
    ];

    const [record] = adaptLinearIssues({ groups });

    expect(record?.state).toBe(expected);
  });
});
