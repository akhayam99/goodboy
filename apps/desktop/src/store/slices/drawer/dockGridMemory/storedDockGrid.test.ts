import { describe, expect, it } from 'vitest';
import { brandId, type ProjectId, type SessionId } from '@goodboy/types';
import type { TerminalTabId } from '../../../../shared/types/terminal';
import { EMPTY_DRAWER_GRID, type DrawerGrid } from '../state';
import { parseStoredDockGrid, storedDockGridOf } from './storedDockGrid';

const SESSION = brandId<SessionId>({ value: 'session-ledger-core' });

const GRID: DrawerGrid = {
  columns: [
    [
      { kind: 'browser', sessionId: SESSION, payload: null },
      {
        kind: 'terminal',
        sessionId: null,
        payload: { terminalId: brandId<TerminalTabId>({ value: 'tab-harborline-dev' }) },
      },
    ],
    [{ kind: 'monitoring', sessionId: null, payload: null }],
  ],
  used: ['monitoring', 'browser', 'terminal'],
  focus: { at: 'tool', kind: 'terminal' },
  widths: { browser: 760, monitoring: 420 },
  splits: { 'browser/terminal': 0.64 },
};

type RawParams = {
  readonly value: unknown;
};

const raw = ({ value }: RawParams): string => JSON.stringify(value);

describe('the dock grid as the session stores it', () => {
  it('reads back the panels, the columns, the widths and the focus it wrote', () => {
    expect(parseStoredDockGrid({ raw: storedDockGridOf({ grid: GRID }) })).toEqual(GRID);
    expect(parseStoredDockGrid({ raw: storedDockGridOf({ grid: EMPTY_DRAWER_GRID }) })).toEqual(
      EMPTY_DRAWER_GRID,
    );
  });

  it('reads and writes all five tools, Scripts and Ask included', () => {
    const grid: DrawerGrid = {
      columns: [
        [
          {
            kind: 'terminal',
            sessionId: null,
            payload: { terminalId: brandId<TerminalTabId>({ value: 'tab-1' }) },
          },
        ],
        [{ kind: 'browser', sessionId: null, payload: null }],
        [
          { kind: 'scripts', sessionId: SESSION, payload: null },
          { kind: 'monitoring', sessionId: null, payload: null },
        ],
        [{ kind: 'ask', sessionId: SESSION, payload: null }],
      ],
      used: ['terminal', 'browser', 'scripts', 'monitoring', 'ask'],
      focus: { at: 'tool', kind: 'ask' },
      widths: { ask: 480 },
      splits: { 'scripts/monitoring': 0.4 },
    };

    expect(parseStoredDockGrid({ raw: storedDockGridOf({ grid }) })).toEqual(grid);
  });

  it('keeps the project of a Scripts panel', () => {
    const grid: DrawerGrid = {
      ...EMPTY_DRAWER_GRID,
      columns: [
        [
          {
            kind: 'scripts',
            sessionId: SESSION,
            payload: { projectId: brandId<ProjectId>({ value: 'project-payments-api' }) },
          },
        ],
      ],
      used: ['scripts'],
    };

    expect(parseStoredDockGrid({ raw: storedDockGridOf({ grid }) })?.columns).toEqual(grid.columns);
  });

  it('still reads a row saved before Scripts and Ask joined the grid', () => {
    const parsed = parseStoredDockGrid({
      raw: raw({
        value: {
          version: 1,
          columns: [
            [{ kind: 'browser', sessionId: null, payload: null }],
            [{ kind: 'monitoring', sessionId: null, payload: null }],
          ],
          used: ['browser', 'monitoring'],
          focus: { at: 'tool', kind: 'monitoring' },
          widths: { browser: 700 },
        },
      }),
    });

    expect(parsed?.columns.flat().map((panel) => panel.kind)).toEqual(['browser', 'monitoring']);
    expect(parsed?.widths).toEqual({ browser: 700 });
  });

  it('writes no face and no detail, and still reads a row an older build saved with them', () => {
    expect(JSON.parse(storedDockGridOf({ grid: GRID }))).not.toHaveProperty('face');
    const older = JSON.stringify({ ...JSON.parse(storedDockGridOf({ grid: GRID })), face: 'desk' });

    expect(parseStoredDockGrid({ raw: older })).toEqual(GRID);
  });

  it.each([
    ['text that is not JSON', 'terminal'],
    ['a version it does not know', raw({ value: { version: 3, columns: [] } })],
    [
      'a panel that is not a tool',
      raw({ value: { version: 2, columns: [[{ kind: 'conversation' }]] } }),
    ],
    [
      'an Ask without its session',
      raw({ value: { version: 2, columns: [[{ kind: 'ask', sessionId: null, payload: null }]] } }),
    ],
    [
      'a Terminal without its tab',
      raw({ value: { version: 1, columns: [[{ kind: 'terminal', sessionId: null }]] } }),
    ],
    [
      'the same tool twice',
      raw({
        value: {
          version: 1,
          columns: [
            [{ kind: 'browser', sessionId: null, payload: null }],
            [{ kind: 'browser', sessionId: null, payload: null }],
          ],
        },
      }),
    ],
    [
      'three columns',
      raw({
        value: {
          version: 1,
          columns: [[], [], []],
        },
      }),
    ],
  ])('reads no grid from %s', (_name, text) => {
    expect(parseStoredDockGrid({ raw: text })).toBeNull();
  });

  it('keeps the panels and drops a width, a use or a focus it cannot read', () => {
    const parsed = parseStoredDockGrid({
      raw: raw({
        value: {
          version: 1,
          columns: [[{ kind: 'browser', sessionId: null, payload: null }]],
          used: ['conversation', 'browser', 'browser'],
          focus: { at: 'tool', kind: 'terminal' },
          widths: { browser: 'wide', terminal: 400, conversation: 300 },
        },
      }),
    });

    expect(parsed).toEqual({
      columns: [[{ kind: 'browser', sessionId: null, payload: null }]],
      used: ['browser'],
      focus: { at: 'page' },
      widths: { terminal: 400 },
      splits: {},
    });
  });

  it('writes the row heights under version 2, beside the fields an older build reads', () => {
    const stored: unknown = JSON.parse(storedDockGridOf({ grid: GRID }));
    const plain: unknown = JSON.parse(storedDockGridOf({ grid: { ...GRID, splits: {} } }));

    expect(stored).toMatchObject({ version: 2, splits: { 'browser/terminal': 0.64 } });
    expect(plain).not.toHaveProperty('splits');
    expect({ ...Object(stored), splits: undefined }).toEqual({
      ...Object(plain),
      splits: undefined,
    });
  });

  it('drops a row height it cannot read and keeps the rest', () => {
    const parsed = parseStoredDockGrid({
      raw: raw({
        value: {
          version: 1,
          columns: [[{ kind: 'browser', sessionId: null, payload: null }]],
          splits: {
            'browser/terminal': 0.3,
            'browser/conversation': 0.4,
            'terminal/monitoring': 1.2,
            monitoring: 0.5,
          },
        },
      }),
    });

    expect(parsed?.splits).toEqual({ 'browser/terminal': 0.3 });
  });
});
