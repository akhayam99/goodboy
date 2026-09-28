import { describe, expect, it } from 'vitest';
import { findMatchRanges } from './findMatchRanges';
import { pickTargetIndex } from './pickTargetIndex';

type HtmlParams = {
  readonly html: string;
};

const rootOf = ({ html }: HtmlParams): Element => {
  const root = document.createElement('div');
  root.innerHTML = html;
  document.body.append(root);
  return root;
};

describe('find in view', () => {
  it('finds every word start, folding case and diacritics, in document order', () => {
    const root = rootOf({
      html: '<p>Tomás paid the <b>Payout</b> export</p><p>repay later, payout again</p>',
    });
    const ranges = findMatchRanges({ root, query: 'pay TOMAS' });
    expect(ranges.map((range) => range.toString())).toEqual(['Tomás', 'Pay', 'pay']);
  });

  it('skips marked regions and returns nothing for punctuation only', () => {
    const root = rootOf({ html: '<p>ledger</p><p data-find-skip>ledger</p>' });
    expect(findMatchRanges({ root, query: 'ledger' })).toHaveLength(1);
    expect(findMatchRanges({ root, query: '** --' })).toEqual([]);
  });

  it('lands on the block that holds the hit snippet', () => {
    const root = rootOf({
      html: '<ul><li>settlement drift in March</li><li>The settlement export times out for large merchants</li></ul>',
    });
    const ranges = findMatchRanges({ root, query: 'settlement' });
    expect(pickTargetIndex({ ranges, target: '…The settlement export times out for large…' })).toBe(
      1,
    );
    expect(pickTargetIndex({ ranges, target: null })).toBe(0);
  });
});
