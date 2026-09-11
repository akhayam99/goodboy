import { describe, expect, it } from 'vitest';
import type { IssueCandidate } from '../../../integrations/fetchIssueCandidates';
import { hasNothingToAdopt, proposeIssueAdoption } from './issueAdoption';

const candidate = (over: Partial<IssueCandidate> = {}): IssueCandidate =>
  ({
    provider: 'linear',
    externalId: 'ext-1',
    identifier: 'LIN-12',
    title: 'Fix the auth redirect',
    url: 'https://example.test/LIN-12',
    goal: 'Users land on a blank page after signing in.',
    branchSlug: 'fix-the-auth-redirect',
    ...over,
  }) as IssueCandidate;

describe('proposeIssueAdoption', () => {
  it('proposes the identifier and title as one session title', () => {
    const adoption = proposeIssueAdoption({
      candidate: candidate(),
      currentTitle: 'Untitled session',
      currentGoal: '',
    });

    expect(adoption.title).toBe('[LIN-12] Fix the auth redirect');
    expect(adoption.identifier).toBe('LIN-12');
  });

  it('clamps a title past the session title limit', () => {
    const adoption = proposeIssueAdoption({
      candidate: candidate({ title: 'x'.repeat(200) }),
      currentTitle: 'Untitled session',
      currentGoal: '',
    });

    expect(adoption.title?.length).toBe(60);
  });

  it('proposes no title when the session already carries it', () => {
    const adoption = proposeIssueAdoption({
      candidate: candidate(),
      currentTitle: '[LIN-12] Fix the auth redirect',
      currentGoal: '',
    });

    expect(adoption.title).toBeNull();
  });

  it('proposes the issue body as the goal when the session has none', () => {
    const adoption = proposeIssueAdoption({
      candidate: candidate(),
      currentTitle: 'Untitled session',
      currentGoal: '',
    });

    expect(adoption.goal).toBe('Users land on a blank page after signing in.');
  });

  it('leaves a goal the session already carries alone', () => {
    const adoption = proposeIssueAdoption({
      candidate: candidate(),
      currentTitle: 'Untitled session',
      currentGoal: 'Something the user wrote',
    });

    expect(adoption.goal).toBeNull();
  });

  it('proposes no goal when the issue carries none', () => {
    const adoption = proposeIssueAdoption({
      candidate: candidate({ goal: '  ' }),
      currentTitle: 'Untitled session',
      currentGoal: '',
    });

    expect(adoption.goal).toBeNull();
  });
});

describe('hasNothingToAdopt', () => {
  it('is true when neither field is on offer', () => {
    expect(hasNothingToAdopt({ adoption: { identifier: 'LIN-12', title: null, goal: null } })).toBe(
      true,
    );
  });

  it('is false while one field is on offer', () => {
    expect(
      hasNothingToAdopt({ adoption: { identifier: 'LIN-12', title: 'a title', goal: null } }),
    ).toBe(false);
  });
});
