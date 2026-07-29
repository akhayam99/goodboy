import { describe, expect, it } from 'vitest';
import type { IsoDateTime, ProviderRunId, TurnEvent } from '@goodboy/types';
import { resolverReportedShas } from './resolver-reported-shas';

const at = '2026-07-25T10:00:00.000Z' as IsoDateTime;

const delta = ({ run, text }: { readonly run: string; readonly text: string }): TurnEvent => ({
  kind: 'assistant_text',
  runId: run as ProviderRunId,
  delta: text,
  at,
});

describe('resolverReportedShas', () => {
  it('reassembles a marker split across streaming deltas', () => {
    const shas = resolverReportedShas({
      events: [
        delta({ run: 'run-1', text: '<<comment-resolved threadId="PRRT_1" ' }),
        delta({ run: 'run-1', text: 'commit="abc1234">>' }),
      ],
    });

    expect(shas).toEqual(['abc1234']);
  });

  it('reports one sha per turn instead of only the last turn', () => {
    const shas = resolverReportedShas({
      events: [
        delta({ run: 'run-1', text: '<<comment-resolved threadId="PRRT_1" commit="aaa1111">>' }),
        delta({ run: 'run-2', text: '<<comment-resolved threadId="PRRT_1" commit="bbb2222">>' }),
      ],
    });

    expect(shas).toEqual(['aaa1111', 'bbb2222']);
  });

  it('accepts every commitSha marker from a combined resolver turn', () => {
    const shas = resolverReportedShas({
      events: [
        delta({
          run: 'run-1',
          text: [
            '<<comment-resolved threadId="PRRT_1" commitSha="aaa1111">>',
            '<<comment-resolved threadId="PRRT_2" commitSha="bbb2222">>',
          ].join('\n'),
        }),
      ],
    });

    expect(shas).toEqual(['aaa1111', 'bbb2222']);
  });

  it('ignores turns without a resolution marker', () => {
    const shas = resolverReportedShas({
      events: [delta({ run: 'run-1', text: 'looked into it, nothing to change' })],
    });

    expect(shas).toEqual([]);
  });
});
