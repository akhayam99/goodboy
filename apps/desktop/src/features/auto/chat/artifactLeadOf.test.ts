import { describe, expect, it } from 'vitest';
import { artifactLeadOf } from './artifactLeadOf';

describe('artifactLeadOf', () => {
  it('reads the summary block of a report and drops its markdown marks', () => {
    expect(
      artifactLeadOf({
        kind: 'report',
        sourceText:
          '<<summary>>\nNo `blocking` issue in **payments-api**.\n<</summary>>\n\n## Body',
      }),
    ).toBe('No blocking issue in payments-api.');
  });

  it('takes the first paragraph after the headings when there is no summary block', () => {
    expect(
      artifactLeadOf({
        kind: 'report',
        sourceText: '# Audit\n\nThe retry path in notify-relay is sound.\n\nMore below.',
      }),
    ).toBe('The retry path in notify-relay is sound.');
  });

  it('cuts a long lead', () => {
    const lead = artifactLeadOf({ kind: 'report', sourceText: 'word '.repeat(100) });

    expect(lead?.endsWith('...')).toBe(true);
    expect(lead?.length).toBeLessThanOrEqual(203);
  });

  it('has no lead for a plan, a wireframe or an empty report', () => {
    expect(artifactLeadOf({ kind: 'plan', sourceText: 'Step one.' })).toBeNull();
    expect(artifactLeadOf({ kind: 'wireframe', sourceText: '<div></div>' })).toBeNull();
    expect(artifactLeadOf({ kind: 'report', sourceText: '  \n\n' })).toBeNull();
  });
});
