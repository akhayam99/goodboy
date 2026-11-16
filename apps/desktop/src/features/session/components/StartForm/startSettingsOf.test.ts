import { describe, expect, it } from 'vitest';
import type { StartFormKind } from './startFormKinds';
import { startSettingsOf } from './startSettingsOf';

const NODES = {
  where: 'where',
  role: 'role',
  asks: 'asks',
  edits: 'edits',
  limit: 'limit',
  guidance: 'guidance',
};

type KeysParams = {
  readonly kind: StartFormKind | null;
};

const keysOf = ({ kind }: KeysParams): ReadonlyArray<string> =>
  startSettingsOf({ kind, nodes: NODES, changed: [] }).map((item) => item.key);

describe('startSettingsOf', () => {
  it('gives every kind that asks and limits the same chip order', () => {
    const expected = ['where', 'asks', 'edits', 'limit', 'guidance'];
    expect(keysOf({ kind: null })).toEqual(expected);
    expect(keysOf({ kind: 'lead' })).toEqual(expected);
    expect(keysOf({ kind: 'preset' })).toEqual(expected);
  });

  it('adds Role to Agent and drops Asks you and Limit', () => {
    expect(keysOf({ kind: 'agent' })).toEqual(['where', 'role', 'edits', 'guidance']);
  });

  it('marks the changed settings', () => {
    const items = startSettingsOf({ kind: 'lead', nodes: NODES, changed: ['limit'] });

    expect(items.filter((item) => item.isChanged).map((item) => item.key)).toEqual(['limit']);
  });
});
