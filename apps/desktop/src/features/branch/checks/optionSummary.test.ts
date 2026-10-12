import { describe, expect, it } from 'vitest';
import { optionSummary } from './optionSummary';

describe('optionSummary', () => {
  it('takes the first prose line of an option body', () => {
    expect(optionSummary({ body: 'Drop repeated ids.\nThe ledger stays unchanged.' })).toBe(
      'Drop repeated ids.',
    );
  });

  it('skips blank lines and fenced code, and drops list and heading markers', () => {
    expect(optionSummary({ body: '\n```diff\n+x\n```\n- Guard the credit' })).toBe(
      'Guard the credit',
    );
  });

  it('is empty when the body holds no prose', () => {
    expect(optionSummary({ body: '```ts\nconst a = 1;\n```' })).toBe('');
    expect(optionSummary({ body: '' })).toBe('');
  });
});
