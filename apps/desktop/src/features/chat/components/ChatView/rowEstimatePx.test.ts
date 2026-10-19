import { describe, expect, it } from 'vitest';
import { brandId } from '@goodboy/types';
import type { IsoDateTime } from '@goodboy/types';
import type { TranscriptRow } from '../../utils/cluster-operations';
import { rowEstimatePx } from './rowEstimatePx';

const at = brandId<IsoDateTime>({ value: '2026-05-15T09:00:00.000Z' });

const userRow = (text: string): TranscriptRow => ({
  kind: 'item',
  key: 'u',
  item: { kind: 'user_text', key: 'u', text, at },
});

const assistantRow = (text: string): TranscriptRow => ({
  kind: 'item',
  key: 'a',
  item: { kind: 'assistant_text', key: 'a', text },
});

type EstimateParams = {
  readonly row: TranscriptRow;
  readonly isClusterOpen?: boolean;
};

type ClusterParams = {
  readonly count: number;
};

const estimate = ({ row, isClusterOpen = false }: EstimateParams) =>
  rowEstimatePx({ row, isClusterOpen });

const cluster = ({ count }: ClusterParams): TranscriptRow => ({
  kind: 'operations',
  key: 'o',
  items: Array.from({ length: count }, (_, index) => ({
    kind: 'assistant_text' as const,
    key: `x${index}`,
    text: 'x',
  })),
});

describe('rowEstimatePx', () => {
  it('grows an answer with its whole length, never capped', () => {
    const short = estimate({ row: assistantRow('Done.') });
    const long = estimate({ row: assistantRow('line\n'.repeat(120)) });
    const longer = estimate({ row: assistantRow('line\n'.repeat(240)) });
    expect(long).toBeGreaterThan(short);
    expect(long).toBeGreaterThan(2400);
    expect(longer - long).toBe(120 * 24);
  });

  it('counts newlines in a user message', () => {
    expect(estimate({ row: userRow('a\nb\nc') })).toBeGreaterThan(
      estimate({ row: userRow('abc') }),
    );
  });

  it('sizes a collapsed operations cluster as its header, whatever its steps', () => {
    expect(estimate({ row: cluster({ count: 1 }) })).toBe(32);
    expect(estimate({ row: cluster({ count: 30 }) })).toBe(32);
  });

  it('sizes an open operations cluster by every step', () => {
    const open = ({ count }: ClusterParams) =>
      estimate({ row: cluster({ count }), isClusterOpen: true });
    expect(open({ count: 2 })).toBeGreaterThan(open({ count: 1 }));
    expect(open({ count: 30 }) - open({ count: 20 })).toBe(10 * 32);
  });

  it('falls back to one default for other kinds', () => {
    const row: TranscriptRow = {
      kind: 'item',
      key: 'p',
      item: { kind: 'error', key: 'p', message: 'It stopped.' },
    };
    expect(estimate({ row })).toBe(72);
  });
});
