import { describe, expect, it } from 'vitest';
import { splitPlanBody } from './splitPlanBody';

describe('splitPlanBody', () => {
  it('lifts the Goal section out as the lead, without its heading', () => {
    expect(
      splitPlanBody({
        bodyMd: '## Goal\nEvery settled batch matches its invoice.\n\n## Approach\n- one rule',
      }),
    ).toEqual({
      lead: 'Every settled batch matches its invoice.',
      rest: '## Approach\n- one rule',
    });
  });

  it('keeps the text before the first heading as the lead of an older plan', () => {
    expect(splitPlanBody({ bodyMd: 'Round once per batch.\n\n## Steps\n1. move it' })).toEqual({
      lead: 'Round once per batch.',
      rest: '## Steps\n1. move it',
    });
  });

  it('leaves a plan with no lead whole', () => {
    expect(splitPlanBody({ bodyMd: '## Steps\n1. move it' })).toEqual({
      lead: '',
      rest: '## Steps\n1. move it',
    });
  });
});
