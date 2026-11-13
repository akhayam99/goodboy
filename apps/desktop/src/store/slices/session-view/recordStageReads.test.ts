// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { areStageReadsCurrent } from './areStageReadsCurrent';
import { recordStageReads } from './recordStageReads';

type Turns = Readonly<Record<string, string>>;

type State = {
  readonly turns: Turns;
  readonly sessions: ReadonlyArray<string>;
  readonly editors: ReadonlyArray<string>;
};

const STATE: State = {
  turns: { 'ledger-core': 'running', 'notify-relay': 'idle' },
  sessions: ['ledger-core', 'notify-relay'],
  editors: [],
};

type ViewParams = {
  readonly view: State;
};

const ledgerTurn = ({ view }: ViewParams): string | undefined => view.turns['ledger-core'];

const turnCount = ({ view }: ViewParams): number => Object.keys(view.turns).length;

describe('recordStageReads', () => {
  it('returns what the derivation returns', () => {
    expect(recordStageReads({ state: STATE, derive: ledgerTurn }).value).toBe('running');
  });

  it('stays current when only another entry of a record it read has changed', () => {
    const { reads } = recordStageReads({ state: STATE, derive: ledgerTurn });
    if (reads === null) {
      throw new Error('the reads are opaque');
    }
    const next: State = { ...STATE, turns: { ...STATE.turns, 'notify-relay': 'running' } };

    expect(areStageReadsCurrent({ reads, state: next })).toBe(true);
  });

  it('goes stale when the entry it read has changed', () => {
    const { reads } = recordStageReads({ state: STATE, derive: ledgerTurn });
    if (reads === null) {
      throw new Error('the reads are opaque');
    }
    const next: State = { ...STATE, turns: { ...STATE.turns, 'ledger-core': 'idle' } };

    expect(areStageReadsCurrent({ reads, state: next })).toBe(false);
  });

  it('ignores a key the derivation never read', () => {
    const { reads } = recordStageReads({ state: STATE, derive: ledgerTurn });
    if (reads === null) {
      throw new Error('the reads are opaque');
    }

    expect(areStageReadsCurrent({ reads, state: { ...STATE, editors: ['zed'] } })).toBe(true);
  });

  it('treats an enumerated record as read whole', () => {
    const { reads } = recordStageReads({ state: STATE, derive: turnCount });
    if (reads === null) {
      throw new Error('the reads are opaque');
    }
    const next: State = { ...STATE, turns: { ...STATE.turns } };

    expect(areStageReadsCurrent({ reads, state: next })).toBe(false);
  });

  it('gives up on reads when the derivation enumerates the whole state', () => {
    const { reads } = recordStageReads({ state: STATE, derive: ({ view }) => Object.keys(view) });

    expect(reads).toBeNull();
  });
});
