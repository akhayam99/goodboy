import { describe, expect, it } from 'vitest';
import { dockColumnsAfterMove } from '../dockColumnsAfterMove';
import type { DockMoveTarget } from '../dockMoveTarget';

type Columns = ReadonlyArray<ReadonlyArray<string>>;

type MoveParams = {
  readonly columns: Columns;
  readonly key: string;
  readonly target: DockMoveTarget;
};

const move = ({ columns, key, target }: MoveParams) =>
  dockColumnsAfterMove({ columns, key, target });

const PAIR: Columns = [['terminal'], ['browser']];

const MOVES: ReadonlyArray<readonly [string, DockMoveTarget, Columns]> = [
  ['stacks above', { at: 'above', key: 'terminal' }, [['browser', 'terminal']]],
  ['stacks below', { at: 'below', key: 'terminal' }, [['terminal', 'browser']]],
  ['opens beside the page', { at: 'page' }, [['browser'], ['terminal']]],
  ['swaps places', { at: 'swap', key: 'terminal' }, [['browser'], ['terminal']]],
];

const REFUSED: ReadonlyArray<readonly [string, string, DockMoveTarget]> = [
  ['a panel that is not in the dock', 'monitoring', { at: 'page' }],
  ['a target that is not in the dock', 'browser', { at: 'above', key: 'monitoring' }],
  ['a place it already has', 'terminal', { at: 'page' }],
];

describe('a panel moved in the dock', () => {
  it.each(MOVES)('%s', (_name, target, expected) => {
    expect(move({ columns: PAIR, key: 'browser', target })).toEqual(expected);
  });

  it('moves out of a stack into a column of its own', () => {
    expect(
      move({
        columns: [['terminal', 'browser']],
        key: 'browser',
        target: { at: 'beside', key: 'terminal', side: 'before' },
      }),
    ).toEqual([['browser'], ['terminal']]);
  });

  it.each(REFUSED)('refuses %s', (_name, key, target) => {
    expect(move({ columns: PAIR, key, target })).toBeNull();
  });

  it('refuses a third row and a fifth column', () => {
    const full: Columns = [['terminal', 'browser'], ['monitoring'], ['scripts'], ['ask']];
    expect(
      move({ columns: full, key: 'monitoring', target: { at: 'above', key: 'terminal' } }),
    ).toBeNull();
    expect(
      move({
        columns: [...full, ['files']],
        key: 'browser',
        target: { at: 'beside', key: 'monitoring', side: 'after' },
      }),
    ).toBeNull();
  });
});
