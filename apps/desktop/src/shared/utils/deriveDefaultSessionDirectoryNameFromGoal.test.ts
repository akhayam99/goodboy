import { describe, expect, it } from 'vitest';
import { deriveDefaultSessionDirectoryNameFromGoal } from './deriveDefaultSessionDirectoryNameFromGoal';

describe('deriveDefaultSessionDirectoryNameFromGoal', () => {
  it('takes the opening words while keeping casing and spaces between words', () => {
    expect(
      deriveDefaultSessionDirectoryNameFromGoal({ goal: 'Prepare a study plan for next week' }),
    ).toBe('Prepare a study plan');
  });

  it('strips only characters rejected by directory-name validation', () => {
    expect(
      deriveDefaultSessionDirectoryNameFromGoal({ goal: 'Roadmap: Q4/2026*launch? draft' }),
    ).toBe('Roadmap Q42026launch draft');
  });

  it('caps defaults to forty characters without cutting a selected word', () => {
    expect(
      deriveDefaultSessionDirectoryNameFromGoal({
        goal: 'Alpha Beta Gamma Delta Epsilon Zeta Eta Theta Iota Kappa',
      }),
    ).toBe('Alpha Beta Gamma Delta');
  });

  it('falls back to session when sanitization removes everything', () => {
    expect(deriveDefaultSessionDirectoryNameFromGoal({ goal: '////****????' })).toBe('session');
  });
});
