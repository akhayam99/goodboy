import { brandId } from '@goodboy/types';
import type { SessionId } from '@goodboy/types';
import { describe, expect, it } from 'vitest';
import type { TerminalTabId } from '../../../shared/types/terminal';
import { gridAfterOpen } from './gridAfterOpen';
import { gridWithout } from './gridWithout';
import { EMPTY_DRAWER_GRID, type DrawerGrid, type OpenDrawer } from './state';

const SESSION_ID = brandId<SessionId>({ value: 'session-1' });

const TERMINAL: OpenDrawer = {
  kind: 'terminal',
  sessionId: null,
  payload: { terminalId: brandId<TerminalTabId>({ value: 'term-1' }) },
};

const BROWSER: OpenDrawer = { kind: 'browser', sessionId: null, payload: null };

const SCRIPTS: OpenDrawer = { kind: 'scripts', sessionId: SESSION_ID, payload: null };

const ASK: OpenDrawer = { kind: 'ask', sessionId: SESSION_ID, payload: null };

const CONVERSATION: OpenDrawer = {
  kind: 'conversation',
  sessionId: SESSION_ID,
  payload: { threadId: 'thread-1' },
};

type OpenParams = {
  readonly entries: ReadonlyArray<OpenDrawer>;
  readonly grid?: DrawerGrid;
};

const opened = ({ entries, grid = EMPTY_DRAWER_GRID }: OpenParams): DrawerGrid =>
  entries.reduce((next, entry) => gridAfterOpen({ grid: next, entry }), grid);

type KindsParams = {
  readonly grid: DrawerGrid;
};

const kindsOf = ({ grid }: KindsParams): ReadonlyArray<ReadonlyArray<string>> =>
  grid.columns.map((column) => column.map((panel) => panel.kind));

describe('the dock grid', () => {
  it('opens the second tool in a new column next to the rail', () => {
    const grid = opened({ entries: [BROWSER, TERMINAL] });

    expect(kindsOf({ grid })).toEqual([['browser'], ['terminal']]);
    expect(grid.focus).toEqual({ at: 'tool', kind: 'terminal' });
  });

  it('opens the third under the column without the Browser', () => {
    const grid = opened({ entries: [TERMINAL, BROWSER, SCRIPTS] });

    expect(kindsOf({ grid })).toEqual([['terminal', 'scripts'], ['browser']]);
  });

  it('opens the fourth under the column that still has room', () => {
    const grid = opened({ entries: [BROWSER, TERMINAL, SCRIPTS, ASK] });

    expect(kindsOf({ grid })).toEqual([
      ['browser', 'ask'],
      ['terminal', 'scripts'],
    ]);
  });

  it('gives the fifth the place of the least recently used, which leaves the grid', () => {
    const grid = opened({ entries: [BROWSER, TERMINAL, SCRIPTS, ASK, CONVERSATION] });

    expect(kindsOf({ grid })).toEqual([
      ['conversation', 'ask'],
      ['terminal', 'scripts'],
    ]);
    expect(grid.used).toEqual(['terminal', 'scripts', 'ask', 'conversation']);
    expect(grid.focus).toEqual({ at: 'tool', kind: 'conversation' });
  });

  it('counts a reopen as a use, so the fifth takes the next oldest', () => {
    const four = opened({ entries: [BROWSER, TERMINAL, SCRIPTS, ASK] });

    const grid = opened({ grid: four, entries: [BROWSER, CONVERSATION] });

    expect(kindsOf({ grid })).toEqual([
      ['browser', 'ask'],
      ['conversation', 'scripts'],
    ]);
  });

  it('replaces a tool of the same kind in its own place', () => {
    const second: OpenDrawer = {
      ...TERMINAL,
      payload: { terminalId: brandId<TerminalTabId>({ value: 'term-2' }) },
    };

    const grid = opened({ entries: [TERMINAL, BROWSER, second] });

    expect(grid.columns).toEqual([[second], [BROWSER]]);
    expect(grid.used).toEqual(['browser', 'terminal']);
  });

  it('drops an empty column when its last tool closes', () => {
    const grid = gridWithout({
      grid: opened({ entries: [BROWSER, TERMINAL, SCRIPTS] }),
      kinds: ['browser'],
    });

    expect(kindsOf({ grid })).toEqual([['terminal', 'scripts']]);
    expect(grid.used).toEqual(['terminal', 'scripts']);
  });
});
