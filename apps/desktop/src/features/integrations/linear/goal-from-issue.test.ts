import { describe, expect, it } from 'vitest';
import { goalFromIssue } from './goal-from-issue';
import type { LinearIssue } from './client';

function makeIssue(overrides: Partial<LinearIssue> = {}): LinearIssue {
  return {
    id: 'lin-1',
    identifier: 'SER-123',
    title: 'Add user signup',
    description: 'Users should be able to sign up with email and password.',
    url: 'https://linear.app/demo-team/issue/SER-123',
    state: { name: 'In Progress', type: 'started' },
    team: { key: 'SER' },
    updatedAt: '2026-05-21T10:00:00Z',
    ...overrides,
  };
}

describe('goalFromIssue', () => {
  it('builds heading + description', () => {
    const goal = goalFromIssue({ issue: makeIssue() });
    expect(goal).toBe(
      '[SER-123] Add user signup\n\nUsers should be able to sign up with email and password.',
    );
  });

  it('returns heading only when description is null or empty', () => {
    expect(goalFromIssue({ issue: makeIssue({ description: null }) })).toBe(
      '[SER-123] Add user signup',
    );
    expect(goalFromIssue({ issue: makeIssue({ description: '   ' }) })).toBe(
      '[SER-123] Add user signup',
    );
  });

  it('cuts an overlong description at a paragraph and links the full issue', () => {
    const paragraph = `${'x'.repeat(99)}.`;
    const long = Array.from({ length: 20 }, () => paragraph).join('\n\n');
    const kept = Array.from({ length: 11 }, () => paragraph).join('\n\n');
    const goal = goalFromIssue({ issue: makeIssue({ description: long }) });
    expect(goal).toBe(
      `[SER-123] Add user signup\n\n${kept}\n\nFull issue: SER-123 https://linear.app/demo-team/issue/SER-123`,
    );
  });

  it('strips title whitespace', () => {
    expect(goalFromIssue({ issue: makeIssue({ title: '  Spaced  ', description: null }) })).toBe(
      '[SER-123] Spaced',
    );
  });
});
