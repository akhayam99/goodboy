import { describe, expect, it } from 'vitest';
import { goalFromIssue } from './goal-from-issue';
import type { GitlabIssue } from './client';

function makeIssue(overrides: Partial<GitlabIssue> = {}): GitlabIssue {
  return {
    id: 101,
    iid: 123,
    projectId: 3,
    title: 'Add user signup',
    description: 'Users should be able to sign up with email and password.',
    state: 'opened',
    webUrl: 'https://gitlab.com/acme/web/-/issues/123',
    references: { full: 'acme/web#123' },
    updatedAt: '2026-05-21T10:00:00Z',
    milestone: null,
    labels: [],
    ...overrides,
  };
}

describe('goalFromIssue', () => {
  it('builds heading + description', () => {
    expect(goalFromIssue({ issue: makeIssue() })).toBe(
      '[acme/web#123] Add user signup\n\nUsers should be able to sign up with email and password.',
    );
  });

  it('returns heading only when description is null or empty', () => {
    expect(goalFromIssue({ issue: makeIssue({ description: null }) })).toBe(
      '[acme/web#123] Add user signup',
    );
    expect(goalFromIssue({ issue: makeIssue({ description: '   ' }) })).toBe(
      '[acme/web#123] Add user signup',
    );
  });

  it('cuts an overlong description at a sentence and links the full issue', () => {
    const sentence = `${'x'.repeat(49)}. `;
    const long = sentence.repeat(40);
    const goal = goalFromIssue({ issue: makeIssue({ description: long }) });
    expect(goal).toBe(
      `[acme/web#123] Add user signup\n\n${sentence.repeat(23).trimEnd()}\n\nFull issue: acme/web#123 https://gitlab.com/acme/web/-/issues/123`,
    );
  });

  it('strips title whitespace', () => {
    expect(goalFromIssue({ issue: makeIssue({ title: '  Spaced  ', description: null }) })).toBe(
      '[acme/web#123] Spaced',
    );
  });
});
