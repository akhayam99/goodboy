import { describe, expect, it } from 'vitest';
import { composeBriefDecisions, decisionNumberOf, type BriefDecisionRow } from './briefDecisions';
import { AUTO_BRIEF_DECISION_CHARS } from './limits';

const rows: ReadonlyArray<BriefDecisionRow> = [
  { number: 3, text: 'Use the batch total.', status: 'replaced', replacedBy: 27 },
  { number: 5, text: 'Keep post_line as it is.', status: 'withdrawn', replacedBy: null },
  { number: 27, text: 'Round once per batch in settle_batch.', status: 'active', replacedBy: null },
];

describe('writing decisions into a brief', () => {
  it('reads an id with or without its letter', () => {
    expect(decisionNumberOf({ id: 'D27' })).toBe(27);
    expect(decisionNumberOf({ id: ' d27 ' })).toBe(27);
    expect(decisionNumberOf({ id: '27' })).toBe(27);
    expect(decisionNumberOf({ id: 'abc1234' })).toBeNull();
  });

  it('writes an active decision in full and says what became of the others', () => {
    const text = composeBriefDecisions({ ids: ['D27', 'D3', 'D5', 'D99', 'nope'], rows });
    expect(text).toContain('- D27 Round once per batch in settle_batch.');
    expect(text).toContain('- D3 was replaced by D27');
    expect(text).toContain('- D5 was withdrawn and does not hold');
    expect(text).toContain('- D99 is not a decision of this conversation');
    expect(text).toContain('- nope is not a decision of this conversation');
  });

  it('writes nothing when no id is named', () => {
    expect(composeBriefDecisions({ ids: [], rows })).toBeNull();
  });

  it('cuts one long decision and marks the cut', () => {
    const long: ReadonlyArray<BriefDecisionRow> = [
      { number: 1, text: 'x'.repeat(5_000), status: 'active', replacedBy: null },
    ];
    const text = composeBriefDecisions({ ids: ['D1'], rows: long }) ?? '';
    expect(text.endsWith(`${'x'.repeat(AUTO_BRIEF_DECISION_CHARS)} (cut)`)).toBe(true);
  });
});
