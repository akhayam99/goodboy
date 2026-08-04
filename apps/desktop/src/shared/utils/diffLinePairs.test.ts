import { describe, expect, it } from 'vitest';
import type { DiffHunkLine } from '@goodboy/types';
import { pairDiffLines } from './diffLinePairs';

const context = (oldLine: number, newLine: number, text: string): DiffHunkLine => ({
  kind: 'context',
  oldLine,
  newLine,
  text,
});

const del = (oldLine: number, text: string): DiffHunkLine => ({
  kind: 'del',
  oldLine,
  newLine: null,
  text,
});

const add = (newLine: number, text: string): DiffHunkLine => ({
  kind: 'add',
  oldLine: null,
  newLine,
  text,
});

const shape = (lines: ReadonlyArray<DiffHunkLine>) =>
  pairDiffLines({ lines }).map((pair) => [pair.old?.text ?? null, pair.new?.text ?? null]);

describe('pairDiffLines', () => {
  it('puts a context line on both sides as one pair', () => {
    expect(shape([context(1, 1, 'same')])).toEqual([['same', 'same']]);
  });

  it('zips a removal run against the addition run that follows it', () => {
    expect(shape([del(4, 'old a'), del(5, 'old b'), add(4, 'new a'), add(5, 'new b')])).toEqual([
      ['old a', 'new a'],
      ['old b', 'new b'],
    ]);
  });

  it('pads the new side when more lines were removed than added', () => {
    expect(shape([del(4, 'old a'), del(5, 'old b'), add(4, 'new a')])).toEqual([
      ['old a', 'new a'],
      ['old b', null],
    ]);
  });

  it('pads the old side when more lines were added than removed', () => {
    expect(shape([del(4, 'old a'), add(4, 'new a'), add(5, 'new b')])).toEqual([
      ['old a', 'new a'],
      [null, 'new b'],
    ]);
  });

  it('leaves the old side empty for a pure addition file', () => {
    expect(shape([add(1, 'first'), add(2, 'second')])).toEqual([
      [null, 'first'],
      [null, 'second'],
    ]);
  });

  it('leaves the new side empty for a pure deletion file', () => {
    expect(shape([del(1, 'first'), del(2, 'second')])).toEqual([
      ['first', null],
      ['second', null],
    ]);
  });

  it('keeps separate change runs apart instead of merging across context', () => {
    expect(
      shape([del(1, 'a'), add(1, 'A'), context(2, 2, 'keep'), del(3, 'b'), add(3, 'B')]),
    ).toEqual([
      ['a', 'A'],
      ['keep', 'keep'],
      ['b', 'B'],
    ]);
  });

  it('returns no pairs for a hunk with no lines', () => {
    expect(shape([])).toEqual([]);
  });

  it('keeps the side line numbers of each half', () => {
    const pairs = pairDiffLines({ lines: [del(7, 'gone'), add(9, 'kept')] });
    expect(pairs[0]?.old?.oldLine).toBe(7);
    expect(pairs[0]?.new?.newLine).toBe(9);
  });
});
