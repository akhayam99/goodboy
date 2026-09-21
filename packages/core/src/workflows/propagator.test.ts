import { describe, expect, it } from 'vitest';
import { fallbackStepOutputSummary, isFallbackStepOutputSummary } from '../summarizer/step-output';
import { buildChainCarryForward, buildParallelCarryForward } from './propagator';

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

  it('keeps the immediate summary and bounds a shortened older outcome preview', () => {
    const immediateOutcome = 'i'.repeat(132);
    const olderOutcome = 'o'.repeat(132);
    const result = buildChainCarryForward({
      steps: [
        { ordinal: 1, name: 'Plan', outputSummary: `${olderOutcome}\nOlder details.` },
        { ordinal: 2, name: 'Implement', outputSummary: 'Implemented the plan.' },
        { ordinal: 3, name: 'Review', outputSummary: `${immediateOutcome}\nNo blockers.` },
      ],
    });
    const olderLine = result.split('\n').find((line) => line.startsWith('- step 1 Plan: '));
    const olderPreview = olderLine?.slice('- step 1 Plan: '.length) ?? '';

    expect(result).toContain(`### step 3 output: Review\n${immediateOutcome}\nNo blockers.`);
    expect(olderPreview.length).toBeLessThanOrEqual(120);
    expect(olderPreview.endsWith('...')).toBe(true);
  });

  it('tells the next step when a legacy fallback carries the predecessor output', () => {
    const legacy = `${'h'.repeat(1500)}\n...\n${'t'.repeat(400)}`;

    const result = buildChainCarryForward({
      steps: [{ ordinal: 1, name: 'Implement', outputSummary: legacy }],
    });

    expect(result).toContain('### step 1 output: Implement\n[unsummarized step output');
    expect(result.endsWith(legacy)).toBe(true);
  });

  it('keeps the fallback marker on an earlier step that is only previewed', () => {
    const marked = fallbackStepOutputSummary({ output: 'a'.repeat(9000) });

    const result = buildChainCarryForward({
      steps: [
        { ordinal: 1, name: 'Scout', outputSummary: marked },
        { ordinal: 2, name: 'Plan', outputSummary: 'Picked option A.' },
      ],
    });
    const previewLine = result.split('\n').find((line) => line.startsWith('- step 1 Scout: '));

    expect(previewLine).toContain('[unsummarized step output, excerpt]');
    expect(
      isFallbackStepOutputSummary({ summary: previewLine?.slice('- step 1 Scout: '.length) ?? '' }),
    ).toBe(true);
  });
});

describe('buildParallelCarryForward', () => {
  it('returns an empty string without branch statuses', () => {
    expect(buildParallelCarryForward({ groupName: 'Implementation', branches: [] })).toBe('');
  });

  it('renders completed summaries and failed branch errors', () => {
    const result = buildParallelCarryForward({
      groupName: 'Implementation',
      branches: [
        { name: 'API', status: 'completed', outputSummary: 'Added the API route.' },
        {
          name: 'UI',
          status: 'failed',
          outputSummary: 'This summary is not rendered.',
          error: 'Typecheck failed\nadditional diagnostics',
        },
      ],
    });

    expect(result).toBe(
      [
        '## workflow handoff',
        '### parallel group output: Implementation',
        '#### branch 1: API',
        'Added the API route.',
        '#### branch 2: UI (failed)',
        'Typecheck failed',
      ].join('\n'),
    );
  });

  it('degrades every branch body when the merged block exceeds 3000 characters', () => {
    const result = buildParallelCarryForward({
      groupName: 'Wide implementation',
      branches: Array.from({ length: 5 }, (_, index) => ({
        name: `Worker ${index + 1}`,
        status: 'completed',
        outputSummary: String(index + 1).repeat(700),
      })),
    });

    expect(result).toContain(`#### branch 1: Worker 1\n${'1'.repeat(280)}`);
    expect(result).not.toContain('1'.repeat(281));
    expect(result).toContain(`#### branch 5: Worker 5\n${'5'.repeat(280)}`);
    expect(result).not.toContain('5'.repeat(281));
  });
});
