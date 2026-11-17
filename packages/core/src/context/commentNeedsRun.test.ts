import { describe, expect, it } from 'vitest';
import {
  extractAllCommentNeedsRun,
  extractAllCommentWontfix,
  extractCommentWontfix,
  stripControlMarkers,
} from './extractors';

describe('extractAllCommentNeedsRun', () => {
  it('reads every needs-run marker with the agent sentence, one per thread', () => {
    const text = [
      'two threads here.',
      '<<comment-resolved threadId="PRRT_1" commitSha="abc1234">>',
      '<<comment-needs-run threadId="PRRT_2" reason="It touches the ledger layout, the payouts route and two new components.">>',
      '<<comment-needs-run threadId="note:7" reason="It asks to move Map<string, Array<T>> -> a store">>',
    ].join('\n');
    expect(extractAllCommentNeedsRun({ assistantText: text })).toEqual([
      {
        threadId: 'PRRT_2',
        reason: 'It touches the ledger layout, the payouts route and two new components.',
      },
      { threadId: 'note:7', reason: 'It asks to move Map<string, Array<T>> -> a store' },
    ]);
  });

  it('drops a marker without a thread id or without a reason', () => {
    expect(
      extractAllCommentNeedsRun({
        assistantText:
          '<<comment-needs-run threadId="PRRT_1">> <<comment-needs-run reason="bigger">>',
      }),
    ).toEqual([]);
  });

  it('never reads a needs-run marker as a wontfix, nor a wontfix as needs-run', () => {
    const text =
      '<<comment-wontfix threadId="PRRT_1" reason="intentional">> <<comment-needs-run threadId="PRRT_2" reason="bigger">>';
    expect(extractAllCommentWontfix(text)).toEqual([{ threadId: 'PRRT_1', reason: 'intentional' }]);
    expect(extractCommentWontfix(text)).toEqual({ threadId: 'PRRT_1', reason: 'intentional' });
    expect(extractAllCommentNeedsRun({ assistantText: text })).toEqual([
      { threadId: 'PRRT_2', reason: 'bigger' },
    ]);
  });

  it('strips a needs-run marker from what the owner reads', () => {
    expect(
      stripControlMarkers(
        'ok <<comment-needs-run threadId="PRRT_1" reason="It touches the payouts route -> two new components">> done',
      ),
    ).toBe('ok  done');
  });
});
