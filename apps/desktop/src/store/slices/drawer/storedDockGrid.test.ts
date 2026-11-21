import { describe, expect, it } from 'vitest';
import { brandId, type SessionId } from '@goodboy/types';
import type { TerminalTabId } from '../../../shared/types/terminal';
import { EMPTY_DRAWER_GRID, type DrawerGrid } from './state';
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

  it.each([
    ['text that is not JSON', 'terminal'],
    ['a version it does not know', raw({ value: { version: 2, columns: [] } })],
    ['a panel that is not a tool', raw({ value: { version: 1, columns: [[{ kind: 'ask' }]] } })],
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
          used: ['ask', 'browser', 'browser'],
          focus: { at: 'tool', kind: 'terminal' },
          widths: { browser: 'wide', terminal: 400, ask: 300 },
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

  it('writes the row heights under version 1, beside the fields an older build reads', () => {
    const stored: unknown = JSON.parse(storedDockGridOf({ grid: GRID }));
    const plain: unknown = JSON.parse(storedDockGridOf({ grid: { ...GRID, splits: {} } }));

    expect(stored).toMatchObject({ version: 1, splits: { 'browser/terminal': 0.64 } });
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
            'browser/ask': 0.4,
            'terminal/monitoring': 1.2,
            monitoring: 0.5,
          },
        },
      }),
    });

    expect(parsed?.splits).toEqual({ 'browser/terminal': 0.3 });
  });
});
