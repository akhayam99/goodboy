import { describe, expect, it } from 'vitest';
import type { JiraIssue } from './client';
import { goalFromIssue } from './goal-from-issue';

const issue = (overrides: Partial<JiraIssue>): JiraIssue =>
  ({
    id: '10042',
    key: 'ENG-142',
    summary: '  Session rail drops focus  ',
    description: '',
    ...overrides,
  }) as JiraIssue;

describe('goalFromIssue', () => {
  it('heads the goal with the issue key and the trimmed summary', () => {
    expect(goalFromIssue({ issue: issue({}) })).toBe('[ENG-142] Session rail drops focus');
  });

  it('appends the description under the heading', () => {
    expect(goalFromIssue({ issue: issue({ description: 'Steps to reproduce' }) })).toBe(
      '[ENG-142] Session rail drops focus\n\nSteps to reproduce',
    );
  });

  it('truncates a long description with an ellipsis', () => {
    const goal = goalFromIssue({ issue: issue({ description: 'x'.repeat(1500) }) });
    expect(goal.endsWith('…')).toBe(true);
    expect(goal.length).toBeLessThan(1300);
  });
});
