// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DECISION_DETAIL_LINE_HEIGHT, decisionChangeDetail } from './decisionChangeLines';

describe('decisionChangeDetail', () => {
  it('reads each change as a diff line and knows which decisions it touched', () => {
    const detail = decisionChangeDetail({
      payload: {
        decisionChanges: [
          { kind: 'added', number: 12, text: 'Key on the event id' },
          { kind: 'replaced', number: 3, by: 12, text: 'Key on the event id', reason: 'noise' },
          { kind: 'withdrawn', number: 5, text: 'Retry counter column', reason: 'drift' },
          { kind: 'reworded', number: 7, text: 'b', previousText: 'a' },
        ],
      },
    });

    expect(detail?.lines.map((line) => [line.sign, line.label, line.note])).toEqual([
      ['+', 'D12', null],
      [null, 'D3 → D12', 'noise'],
      ['−', 'D5', 'withdrawn: drift'],
    ]);
    expect(detail?.numbers).toEqual([12, 3, 5]);
    expect(detail?.height).toBe(4 * DECISION_DETAIL_LINE_HEIGHT + 8);
  });

  it('caps the lines and counts the rest', () => {
    const detail = decisionChangeDetail({
      payload: {
        decisionChanges: Array.from({ length: 9 }, (_, index) => ({
          kind: 'added' as const,
          number: index + 1,
          text: `Decision ${index + 1}`,
        })),
      },
    });

    expect(detail?.lines).toHaveLength(6);
    expect(detail?.hiddenCount).toBe(3);
    expect(detail?.height).toBe(8 * DECISION_DETAIL_LINE_HEIGHT + 8);
  });

  it('has nothing to open for an old event or a pure rewording', () => {
    expect(decisionChangeDetail({ payload: { added: 3, removed: 1 } })).toBeNull();
    expect(
      decisionChangeDetail({
        payload: {
          decisionChanges: [{ kind: 'reworded', number: 1, text: 'b', previousText: 'a' }],
        },
      }),
    ).toBeNull();
  });
});
