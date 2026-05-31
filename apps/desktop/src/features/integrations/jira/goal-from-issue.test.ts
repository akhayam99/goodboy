import { describe, expect, it } from 'vitest';
import { goalFromIssue } from './goal-from-issue';
import type { JiraIssue } from './client';

function makeIssue(overrides: Partial<JiraIssue> = {}): JiraIssue {
  return {
    id: 'jira-1',
    key: 'PROJ-123',
    title: 'Add user signup',
    description: 'Users should be able to sign up with email and password.',
    url: 'https://example.atlassian.net/browse/PROJ-123',
    status: { name: 'In Progress', statusCategoryKey: 'indeterminate' },
    updatedAt: '2026-05-21T10:00:00Z',
    ...overrides,
  };
}

describe('goalFromIssue (Jira)', () => {
  it('builds heading + description', () => {
    const goal = goalFromIssue(makeIssue());
    expect(goal).toBe(
      '[PROJ-123] Add user signup\n\nUsers should be able to sign up with email and password.',
    );
  });

  it('returns heading only when description is null or empty', () => {
    expect(goalFromIssue(makeIssue({ description: null }))).toBe('[PROJ-123] Add user signup');
    expect(goalFromIssue(makeIssue({ description: '   ' }))).toBe('[PROJ-123] Add user signup');
  });

  it('trims trailing whitespace and overlong descriptions', () => {
    const long = 'x'.repeat(2000);
    const goal = goalFromIssue(makeIssue({ description: long }));
    expect(goal.endsWith('…')).toBe(true);
    expect(goal.length).toBeLessThanOrEqual(1300);
  });

  it('strips title whitespace', () => {
    expect(goalFromIssue(makeIssue({ title: '  Spaced  ', description: null }))).toBe(
      '[PROJ-123] Spaced',
    );
  });

  it('uses issue key not internal id in heading', () => {
    const goal = goalFromIssue(makeIssue({ key: 'ENG-999', description: null }));
    expect(goal).toStartWith('[ENG-999]');
  });
});
