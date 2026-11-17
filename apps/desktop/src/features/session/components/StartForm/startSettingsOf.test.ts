import { describe, expect, it } from 'vitest';
import type { StartFormKind } from './startFormKinds';
import { startSettingsOf } from './startSettingsOf';

const NODES = {
  where: 'where',
  asks: 'asks',
  edits: 'edits',
  limit: 'limit',
  guidance: 'guidance',
};

type KeysParams = {
  readonly kind: StartFormKind | null;
};

const keysOf = ({ kind }: KeysParams): ReadonlyArray<string> =>
  startSettingsOf({ kind, nodes: NODES, words: {}, changed: [] }).map((item) => item.key);

describe('startSettingsOf', () => {
  it('gives every kind that asks and limits the same chip order', () => {
    const expected = ['where', 'asks', 'edits', 'limit', 'guidance'];
    expect(keysOf({ kind: null })).toEqual(expected);
    expect(keysOf({ kind: 'lead' })).toEqual(expected);
    expect(keysOf({ kind: 'preset' })).toEqual(expected);
  });

  it('drops Asks you and Limit for one agent, whose role sits in the Plan row', () => {
    expect(keysOf({ kind: 'agent' })).toEqual(['where', 'edits', 'guidance']);
  });

  it('marks the changed settings and keeps the words of each', () => {
    const items = startSettingsOf({
      kind: 'lead',
      nodes: NODES,
      words: { limit: { lead: 'Limit', value: '$8.00' } },
      changed: ['limit'],
    });

    expect(items.filter((item) => item.isChanged).map((item) => item.key)).toEqual(['limit']);
    expect(items.find((item) => item.key === 'limit')?.words).toEqual({
      lead: 'Limit',
      value: '$8.00',
    });
    expect(items.find((item) => item.key === 'edits')?.words).toBeNull();
  });
});
