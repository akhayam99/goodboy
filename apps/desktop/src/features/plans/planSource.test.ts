import { describe, expect, it } from 'vitest';
import { parsePlanSource, planToSource } from './planSource';

describe('planSource', () => {
  it('writes the title as a heading above the body', () => {
    expect(planToSource({ title: 'Backfill the settled batches', bodyMd: '## Goal\nmatch' })).toBe(
      '# Backfill the settled batches\n\n## Goal\nmatch',
    );
  });

  it('keeps a title that is only a heading line', () => {
    expect(planToSource({ title: 'Round once', bodyMd: '' })).toBe('# Round once');
  });

  it('reads the first non blank line as the title and trims blank edges off the body', () => {
    expect(parsePlanSource({ source: '\n\n# Round once\n\n\n## Goal\nmatch\n\n' })).toEqual({
      title: 'Round once',
      bodyMd: '## Goal\nmatch',
    });
  });

  it('trims whitespace only lines off both edges of the body and keeps inner indentation', () => {
    expect(parsePlanSource({ source: '# Round once\n  \n\t\n## Goal\n  match\n \n\t \n' })).toEqual(
      {
        title: 'Round once',
        bodyMd: '## Goal\n  match',
      },
    );
  });

  it('returns an empty body when only whitespace follows the title', () => {
    expect(parsePlanSource({ source: '# Round once\n  \n\t' })).toEqual({
      title: 'Round once',
      bodyMd: '',
    });
  });

  it('returns an empty title for an empty source', () => {
    expect(parsePlanSource({ source: '  \n\n' })).toEqual({ title: '', bodyMd: '' });
  });

  it('round trips a plan', () => {
    const plan = { title: 'Skip settled batches in retries', bodyMd: 'one\n\ntwo' };
    expect(parsePlanSource({ source: planToSource(plan) })).toEqual(plan);
  });
});
