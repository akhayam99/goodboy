// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { RETIRED } from './retired/send-to-lead';

type Params = {
  readonly text: string;
};

const retiredIdsIn = ({ text }: Params): ReadonlyArray<string> =>
  RETIRED.filter((retired) => retired.pattern.test(text)).map((retired) => retired.id);

describe('the words that hand work to a Lead', () => {
  it.each([
    ['Send to Implementer', 'send-to-implementer'],
    ['Fix with the Implementer', 'fix-with-the-implementer'],
    ['Resolve with the Lead', 'resolve-with-the-lead'],
  ])('retires %s', (text, id) => {
    expect(retiredIdsIn({ text })).toContain(id);
  });

  it.each([
    'Send to Lead',
    'Send to Lead…',
    'Start new Lead',
    'Message the Implementer',
    'Message the Implementers',
    'Add to message',
  ])('keeps %s', (text) => {
    expect(retiredIdsIn({ text })).toEqual([]);
  });
});
