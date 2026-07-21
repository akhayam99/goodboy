import { describe, expect, it } from 'vitest';
import { buildChainCarryForward } from './propagator';

describe('buildChainCarryForward', () => {
  it('returns an empty string without predecessors', () => {
    expect(buildChainCarryForward({ steps: [] })).toBe('');
  });

  it('renders the full immediate predecessor summary without earlier steps', () => {
    const result = buildChainCarryForward({
      steps: [
        { ordinal: 2, name: 'Implement', outputSummary: 'Changed `src/auth.ts`.\n- Tests pass' },
      ],
    });

    expect(result).toBe(
      '## workflow handoff\n### step 2 output: Implement\nChanged `src/auth.ts`.\n- Tests pass',
    );
    expect(result).not.toContain('### earlier steps');
  });

  it('sorts predecessors and degrades older summaries by distance', () => {
    const nearestSummary = `${'n'.repeat(275)}\nnearest tail`;
    const result = buildChainCarryForward({
      steps: [
        { ordinal: 3, name: 'Review', outputSummary: 'Review passed.\nNo blockers.' },
        { ordinal: 1, name: 'Plan', outputSummary: 'Plan selected option A.\nPlan details.' },
        { ordinal: 2, name: 'Implement', outputSummary: nearestSummary },
      ],
    });

    expect(result).toContain('### step 3 output: Review\nReview passed.\nNo blockers.');
    expect(result).toContain(`- step 2 Implement: ${nearestSummary.slice(0, 280)}`);
    expect(result).toContain('- step 1 Plan: Plan selected option A.');
    expect(result.indexOf('- step 2')).toBeLessThan(result.indexOf('- step 1'));
  });

  it('degrades missing and empty output without throwing', () => {
    const result = buildChainCarryForward({
      steps: [
        undefined,
        { ordinal: 1, name: 'Plan' },
        { ordinal: 2, name: 'Implement', outputSummary: '' },
      ],
    });

    expect(result).toContain('### step 2 output: Implement\n(no output captured)');
    expect(result).toContain('- step 1 Plan: (no output captured)');
  });
});
