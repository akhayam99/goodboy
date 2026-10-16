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

describe('rowEstimatePx', () => {
  it('grows an answer with its length and caps it', () => {
    const short = rowEstimatePx({ row: assistantRow('Done.') });
    const long = rowEstimatePx({ row: assistantRow('word '.repeat(400)) });
    const huge = rowEstimatePx({ row: assistantRow('word '.repeat(40000)) });
    expect(long).toBeGreaterThan(short);
    expect(huge).toBeLessThan(1200);
  });

  it('counts newlines in a user message', () => {
    expect(rowEstimatePx({ row: userRow('a\nb\nc') })).toBeGreaterThan(
      rowEstimatePx({ row: userRow('abc') }),
    );
  });

  it('sizes an operations cluster by its steps', () => {
    const items = [
      { kind: 'assistant_text' as const, key: 'x', text: 'x' },
      { kind: 'assistant_text' as const, key: 'y', text: 'y' },
    ];
    const one = rowEstimatePx({ row: { kind: 'operations', key: 'o', items: items.slice(0, 1) } });
    const two = rowEstimatePx({ row: { kind: 'operations', key: 'o', items } });
    expect(two).toBeGreaterThan(one);
  });

  it('falls back to one default for other kinds', () => {
    const row: TranscriptRow = {
      kind: 'item',
      key: 'p',
      item: { kind: 'error', key: 'p', message: 'It stopped.' },
    };
    expect(rowEstimatePx({ row })).toBe(72);
  });
});
