import { describe, expect, it } from 'vitest';
import { lineDiff } from './lineDiff';
import { textChangesOf, type TextChanges } from './textChangesOf';

type ShapeParams = Readonly<{ rows: TextChanges['rows'] }>;

const shapeOf = ({ rows }: ShapeParams): ReadonlyArray<string> =>
  rows.map((row) => {
    if (row.kind === 'gap') {
      return `gap ${row.lines.length}`;
    }
    if (row.kind === 'more') {
      return `more ${row.count}`;
    }
    return `${row.line.kind} ${row.line.lineNumber}`;
  });

type NumberedParams = Readonly<{ count: number }>;

const numbered = ({ count }: NumberedParams): string =>
  Array.from({ length: count }, (_, index) => `line ${index + 1}`).join('\n');

describe('lineDiff', () => {
  it('finds the shortest set of added and removed lines', () => {
    const edits = lineDiff({ before: ['a', 'b', 'c', 'd'], after: ['a', 'c', 'x', 'd'] });
    expect(edits.map((edit) => edit.kind)).toEqual(['same', 'del', 'same', 'add', 'same']);
  });

  it('replaces everything when the edit budget runs out, and still covers every line', () => {
    const edits = lineDiff({ before: ['a', 'b', 'c'], after: ['x', 'y', 'z'], maxEdits: 2 });
    expect(edits.filter((edit) => edit.kind === 'del')).toHaveLength(3);
    expect(edits.filter((edit) => edit.kind === 'add')).toHaveLength(3);
  });
});

describe('textChangesOf', () => {
  it('counts the added and removed lines it shows', () => {
    const before = [
      '# Launch memo',
      '',
      'Teams of all sizes who write a lot.',
      '',
      '## Pricing',
    ].join('\n');
    const after = [
      '# Launch memo',
      '',
      'Teams of 5 to 200 people who write a lot and share most of it.',
      '',
      '## Pricing',
    ].join('\n');

    const changes = textChangesOf({ before, after });

    expect(changes.additions).toBe(1);
    expect(changes.deletions).toBe(1);
    expect(shapeOf({ rows: changes.rows })).toEqual([
      'same 1',
      'same 2',
      'del 3',
      'add 3',
      'same 4',
      'same 5',
    ]);
  });

  it('marks the words that changed on a paired line', () => {
    const changes = textChangesOf({
      before: 'Teams of all sizes who write a lot.',
      after: 'Teams of five people who write a lot.',
    });
    const removed = changes.rows.find((row) => row.kind === 'line' && row.line.kind === 'del');
    const marked =
      removed?.kind === 'line'
        ? removed.line.segments
            .filter((segment) => segment.isChanged)
            .map((segment) => segment.text)
        : [];
    expect(marked.join(' ')).toContain('all sizes');
  });

  it('folds long unchanged runs into a gap with the hidden lines', () => {
    const before = numbered({ count: 30 });
    const after = before.replace('line 15', 'line fifteen');

    const changes = textChangesOf({ before, after });

    expect(shapeOf({ rows: changes.rows })).toEqual([
      'gap 11',
      'same 12',
      'same 13',
      'same 14',
      'del 15',
      'add 15',
      'same 16',
      'same 17',
      'same 18',
      'gap 12',
    ]);
  });

  it('shows a new file as added lines only', () => {
    const changes = textChangesOf({
      before: null,
      after: 'What people told us\n\n1. Search is slow\n',
    });
    expect(changes.additions).toBe(3);
    expect(changes.deletions).toBe(0);
    expect(shapeOf({ rows: changes.rows })).toEqual(['add 1', 'add 2', 'add 3']);
  });

  it('caps a very large change and says how many lines are left', () => {
    const changes = textChangesOf({ before: null, after: numbered({ count: 900 }) });
    expect(changes.additions).toBe(900);
    expect(shapeOf({ rows: changes.rows }).at(-1)).toBe('more 100');
  });

  it('shows nothing when the text did not change', () => {
    expect(textChangesOf({ before: 'same\n', after: 'same\n' }).rows).toEqual([]);
  });
});
