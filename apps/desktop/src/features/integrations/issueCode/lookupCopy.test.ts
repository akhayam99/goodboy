import { describe, expect, it } from 'vitest';
import type { InboxRecord } from '../../inbox/types';
import { lookupHitSecondLine } from './lookupCopy';

const record = (patch: Partial<InboxRecord>): InboxRecord => ({
  key: 'linear:issue:1',
  provider: 'linear',
  kind: 'issue',
  identifier: 'CAS-231',
  title: 'Settle the month close',
  state: 'open',
  stateLabel: 'Todo',
  updatedAt: '2026-09-20T10:00:00Z',
  url: 'https://linear.app/cascadia/issue/CAS-231',
  context: 'Cascadia',
  payload: { provider: 'linear', kind: 'issue', sessionId: null, issue: {} as never },
  ...patch,
});

describe('lookupHitSecondLine', () => {
  it('shows the Linear assignee when known', () => {
    const withAssignee = record({
      payload: {
        provider: 'linear',
        kind: 'issue',
        sessionId: null,
        issue: { assignee: { name: 'Priya Moss' } } as never,
      },
    });
    expect(lookupHitSecondLine(withAssignee)).toBe('Assigned to Priya Moss');
  });

  it('shows the Jira assignee when known', () => {
    const withAssignee = record({
      provider: 'jira',
      payload: {
        provider: 'jira',
        kind: 'issue',
        sessionId: null,
        issue: { assignee: { displayName: 'Priya Moss' } } as never,
      },
    });
    expect(lookupHitSecondLine(withAssignee)).toBe('Assigned to Priya Moss');
  });

  it('falls back to context when the Linear issue has no assignee', () => {
    const unassigned = record({
      payload: {
        provider: 'linear',
        kind: 'issue',
        sessionId: null,
        issue: { assignee: null } as never,
      },
    });
    expect(lookupHitSecondLine(unassigned)).toBe('Cascadia');
  });

  it('falls back to context for providers with no assignee concept', () => {
    const githubRecord = record({
      provider: 'github',
      context: 'ledger-core',
      payload: { provider: 'github', kind: 'issue', sessionId: null, issue: {} as never },
    });
    expect(lookupHitSecondLine(githubRecord)).toBe('ledger-core');
  });
});
