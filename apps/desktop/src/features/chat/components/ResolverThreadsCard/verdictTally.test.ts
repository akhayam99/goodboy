import { describe, expect, it } from 'vitest';
import { verdictTally } from './verdictTally';
import { RESOLVER_OUTCOME_LABEL, RESOLVER_OUTCOME_ORDER, resolverOutcome } from './resolverOutcome';
import type { ResolverThreadVerdictKind } from './resolverThreadVerdicts';

const verdict = ({
  kind,
  isClosed = false,
}: {
  readonly kind: ResolverThreadVerdictKind;
  readonly isClosed?: boolean;
}) => ({ kind, isClosed });

describe('verdictTally', () => {
  it('counts a closed thread apart from the ones that need you', () => {
    const tally = verdictTally({
      verdicts: [verdict({ kind: 'open', isClosed: true }), verdict({ kind: 'open' })],
    });

    expect(tally.counts.needs_you).toBe(1);
    expect(tally.counts.closed).toBe(1);
    expect(tally.total).toBe(2);
  });

  it('counts a closed thread as closed, the word its own row shows', () => {
    const tally = verdictTally({
      verdicts: [
        verdict({ kind: 'resolved', isClosed: true }),
        verdict({ kind: 'wontfix', isClosed: true }),
      ],
    });

    expect(tally.counts.closed).toBe(2);
    expect(tally.counts.fixed).toBe(0);
    expect(tally.counts.no_change).toBe(0);
  });

  it('counts every verdict under the very word its own row reads', () => {
    const verdicts = [
      verdict({ kind: 'resolved', isClosed: true }),
      verdict({ kind: 'resolved' }),
      verdict({ kind: 'analyzed' }),
      verdict({ kind: 'open' }),
    ];
    const tally = verdictTally({ verdicts });
    const rowWords = verdicts.map((entry) => RESOLVER_OUTCOME_LABEL[resolverOutcome(entry)]);
    const countedWords = RESOLVER_OUTCOME_ORDER.flatMap((outcome) =>
      Array.from({ length: tally.counts[outcome] }, () => RESOLVER_OUTCOME_LABEL[outcome]),
    );

    expect(countedWords.slice().sort()).toEqual(rowWords.slice().sort());
  });

  it('leaves an untouched agent counting exactly as its verdicts read', () => {
    const tally = verdictTally({
      verdicts: [verdict({ kind: 'resolved' }), verdict({ kind: 'open' })],
    });

    expect(tally.counts.closed).toBe(0);
    expect(tally.counts.fixed).toBe(1);
    expect(tally.counts.needs_you).toBe(1);
  });
});
