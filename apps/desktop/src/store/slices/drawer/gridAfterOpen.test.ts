import { brandId } from '@goodboy/types';
import type { AgentId, SessionId } from '@goodboy/types';
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

const MONITORING: OpenDrawer = { kind: 'monitoring', sessionId: null, payload: null };

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

describe('the natural place of each kind', () => {
  it('stacks the row kinds in one tool column', () => {
    const grid = opened({ entries: [SCRIPTS, MONITORING] });

    expect(kindsOf({ grid })).toEqual([['scripts', 'monitoring']]);
  });

  it('keeps the tool column beside the Terminal, and the Browser takes a column of its own', () => {
    const grid = opened({ entries: [SCRIPTS, TERMINAL, MONITORING, BROWSER] });

    expect(kindsOf({ grid })).toEqual([['scripts', 'monitoring'], ['terminal'], ['browser']]);
  });

  it('holds all five tools in four columns', () => {
    const grid = opened({ entries: [TERMINAL, BROWSER, SCRIPTS, MONITORING, ASK] });

    expect(kindsOf({ grid })).toEqual([
      ['terminal'],
      ['browser'],
      ['scripts', 'monitoring'],
      ['ask'],
    ]);
    expect(grid.used).toEqual(['terminal', 'browser', 'scripts', 'monitoring', 'ask']);
  });

  it('keeps a row kind off a column that holds a Terminal or a Browser while a column is free', () => {
    const grid = opened({ entries: [TERMINAL, MONITORING] });

    expect(kindsOf({ grid })).toEqual([['terminal'], ['monitoring']]);
  });

  it('puts a row kind under the roomier column once the columns are full', () => {
    const grid = opened({ entries: [BROWSER, TERMINAL, SCRIPTS, MONITORING, ASK, CONVERSATION] });

    expect(kindsOf({ grid })).toEqual([
      ['browser'],
      ['terminal'],
      ['scripts', 'monitoring'],
      ['ask', 'conversation'],
    ]);
  });
});

describe('the dock grid', () => {
  it('opens the second tool in a new column next to the rail', () => {
    const grid = opened({ entries: [BROWSER, TERMINAL] });

    expect(kindsOf({ grid })).toEqual([['browser'], ['terminal']]);
    expect(grid.focus).toEqual({ at: 'tool', kind: 'terminal' });
  });

  it('opens a row kind in its own column while a column is free', () => {
    const grid = opened({ entries: [TERMINAL, BROWSER, SCRIPTS] });

    expect(kindsOf({ grid })).toEqual([['terminal'], ['browser'], ['scripts']]);
  });

  it('opens the next row kind under the one before it', () => {
    const grid = opened({ entries: [BROWSER, TERMINAL, SCRIPTS, MONITORING] });

    expect(kindsOf({ grid })).toEqual([['browser'], ['terminal'], ['scripts', 'monitoring']]);
  });

  const FULL: ReadonlyArray<OpenDrawer> = [
    BROWSER,
    TERMINAL,
    SCRIPTS,
    MONITORING,
    ASK,
    CONVERSATION,
    {
      kind: 'transcript',
      sessionId: SESSION_ID,
      payload: { agentId: brandId<AgentId>({ value: 'agent-1' }) },
    },
    { kind: 'new', sessionId: SESSION_ID, payload: { form: 'report' } },
  ];

  it('gives the ninth the place of the least recently used, which leaves the grid', () => {
    const next: OpenDrawer = {
      kind: 'fix-comments',
      sessionId: SESSION_ID,
      payload: { mountId: null },
    };

    const grid = opened({ entries: [...FULL, next] });

    expect(grid.columns.flat()).toHaveLength(8);
    expect(grid.columns.flat().some((panel) => panel.kind === 'browser')).toBe(false);
    expect(grid.columns.flat().some((panel) => panel.kind === 'fix-comments')).toBe(true);
    expect(grid.used).not.toContain('browser');
    expect(grid.focus).toEqual({ at: 'tool', kind: 'fix-comments' });
  });

  it('counts a reopen as a use, so the ninth takes the next oldest', () => {
    const next: OpenDrawer = {
      kind: 'fix-comments',
      sessionId: SESSION_ID,
      payload: { mountId: null },
    };
    const full = opened({ entries: FULL });

    const grid = opened({ grid: full, entries: [BROWSER, next] });

    expect(grid.columns.flat().some((panel) => panel.kind === 'browser')).toBe(true);
    expect(grid.columns.flat().some((panel) => panel.kind === 'terminal')).toBe(false);
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

    expect(kindsOf({ grid })).toEqual([['terminal'], ['scripts']]);
    expect(grid.used).toEqual(['terminal', 'scripts']);
  });
});
