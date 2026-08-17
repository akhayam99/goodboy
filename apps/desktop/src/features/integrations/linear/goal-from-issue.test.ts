import { describe, expect, it } from 'vitest';
import { goalFromIssue } from './goal-from-issue';
import type { LinearIssue } from './client';

function makeIssue(overrides: Partial<LinearIssue> = {}): LinearIssue {
  return {
    id: 'lin-1',
    identifier: 'SER-123',
    title: 'Add user signup',
    description: 'Users should be able to sign up with email and password.',
    url: 'https://linear.app/serenis/issue/SER-123',
    state: { name: 'In Progress', type: 'started' },
    team: { key: 'SER' },
    updatedAt: '2026-05-21T10:00:00Z',
    ...overrides,
  };
}

describe('goalFromIssue', () => {
  it('builds heading + description', () => {
    const goal = goalFromIssue(makeIssue());
    expect(goal).toBe(
      '[SER-123] Add user signup\n\nUsers should be able to sign up with email and password.',
    );
  });

  it('returns heading only when description is null or empty', () => {
    expect(goalFromIssue(makeIssue({ description: null }))).toBe('[SER-123] Add user signup');
    expect(goalFromIssue(makeIssue({ description: '   ' }))).toBe('[SER-123] Add user signup');
  });

  it('keeps overlong descriptions intact after trimming whitespace', () => {
    const long = 'x'.repeat(2000);
    const goal = goalFromIssue(makeIssue({ description: long }));
    expect(goal).toBe(`[SER-123] Add user signup\n\n${long}`);
  });

  it('strips title whitespace', () => {
    expect(goalFromIssue(makeIssue({ title: '  Spaced  ', description: null }))).toBe(
      '[SER-123] Spaced',
    );
  });
});
