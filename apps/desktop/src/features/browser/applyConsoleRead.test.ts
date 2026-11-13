// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  CONSOLE_KEPT_ROWS,
  EMPTY_TAB_CONSOLE,
  applyConsoleRead,
  type TabConsole,
} from './applyConsoleRead';
import type { BrowserConsoleEntry } from './types';

type LineParams = {
  readonly seq: number;
};

const line = ({ seq }: LineParams): BrowserConsoleEntry => ({
  seq,
  kind: 'console',
  level: 'log',
  text: `line ${seq}`,
  source: null,
  method: null,
  status: null,
});

const READ: TabConsole = {
  ...EMPTY_TAB_CONSOLE,
  doc: 'k3x9',
  after: 2,
  entries: [line({ seq: 1 }), line({ seq: 2 })],
  hasLogged: true,
};

describe('applying a console read', () => {
  it('appends the entries after the cursor and moves the cursor', () => {
    const next = applyConsoleRead({
      current: READ,
      sent: { doc: 'k3x9', after: 2 },
      answer: { doc: 'k3x9', entries: [line({ seq: 3 }), line({ seq: 4 })], isHeard: true },
    });

    expect(next?.entries.map((entry) => entry.seq)).toEqual([1, 2, 3, 4]);
    expect(next?.after).toBe(4);
  });

  it('drops an answer for an older cursor', () => {
    const next = applyConsoleRead({
      current: READ,
      sent: { doc: 'k3x9', after: 0 },
      answer: { doc: 'k3x9', entries: [line({ seq: 1 })], isHeard: true },
    });

    expect(next).toBeNull();
  });

  it('starts over on a new load', () => {
    const next = applyConsoleRead({
      current: READ,
      sent: { doc: 'k3x9', after: 2 },
      answer: { doc: 'p2m7', entries: [line({ seq: 1 })], isHeard: true },
    });

    expect(next?.doc).toBe('p2m7');
    expect(next?.entries.map((entry) => entry.seq)).toEqual([1]);
    expect(next?.after).toBe(1);
  });

  it('says the console stopped reporting after two unheard reads that follow a logged entry', () => {
    const once = applyConsoleRead({
      current: READ,
      sent: { doc: 'k3x9', after: 2 },
      answer: { doc: null, entries: [], isHeard: false },
    });
    const twice =
      once === null
        ? null
        : applyConsoleRead({
            current: once,
            sent: { doc: 'k3x9', after: 2 },
            answer: { doc: null, entries: [], isHeard: false },
          });

    expect(once?.failure).toBeNull();
    expect(twice?.failure).toBe('silent');
    expect(twice?.entries).toHaveLength(2);
  });

  it('stays quiet about a page that never logged', () => {
    const quiet = applyConsoleRead({
      current: { ...EMPTY_TAB_CONSOLE, misses: 1 },
      sent: { doc: null, after: 0 },
      answer: { doc: null, entries: [], isHeard: false },
    });

    expect(quiet?.failure).toBeNull();
  });

  it('keeps at most the newest five hundred rows', () => {
    const many = Array.from({ length: CONSOLE_KEPT_ROWS }, (_, index) => line({ seq: index + 3 }));
    const next = applyConsoleRead({
      current: READ,
      sent: { doc: 'k3x9', after: 2 },
      answer: { doc: 'k3x9', entries: many, isHeard: true },
    });

    expect(next?.entries).toHaveLength(CONSOLE_KEPT_ROWS);
    expect(next?.entries[0]?.seq).toBe(3);
  });
});
