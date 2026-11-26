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
  network: null,
  error: null,
});

type RequestParams = LineParams & {
  readonly id: string;
  readonly status: number | null;
};

const request = ({ seq, id, status }: RequestParams): BrowserConsoleEntry => ({
  seq,
  kind: 'network',
  level: 'info',
  text: `/api/orders/${id}`,
  source: null,
  method: 'GET',
  status,
  network: {
    id,
    type: 'fetch',
    start: seq,
    duration: null,
    size: null,
    requestHeaders: [],
    responseHeaders: [],
    requestBody: null,
    responseBody: null,
    socket: null,
  },
  error: null,
});

const failure = ({ seq }: LineParams): BrowserConsoleEntry => ({
  ...line({ seq }),
  kind: 'error',
  level: 'error',
  error: { origin: 'uncaught', stack: null, requestId: null, at: null },
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
      answer: {
        doc: 'k3x9',
        entries: [line({ seq: 3 }), line({ seq: 4 })],
        watermark: 0,
        isHeard: true,
      },
    });

    expect(next?.entries.map((entry) => entry.seq)).toEqual([1, 2, 3, 4]);
    expect(next?.after).toBe(4);
  });

  it('moves the cursor to the watermark when every row of a batch was filtered out', () => {
    const next = applyConsoleRead({
      current: READ,
      sent: { doc: 'k3x9', after: 2 },
      answer: { doc: 'k3x9', entries: [], watermark: 501, isHeard: true },
    });

    expect(next?.after).toBe(501);
    expect(next?.entries.map((entry) => entry.seq)).toEqual([1, 2]);
  });

  it('drops an answer for an older cursor', () => {
    const next = applyConsoleRead({
      current: READ,
      sent: { doc: 'k3x9', after: 0 },
      answer: { doc: 'k3x9', entries: [line({ seq: 1 })], watermark: 0, isHeard: true },
    });

    expect(next).toBeNull();
  });

  it('starts over on a new load', () => {
    const next = applyConsoleRead({
      current: READ,
      sent: { doc: 'k3x9', after: 2 },
      answer: { doc: 'p2m7', entries: [line({ seq: 1 })], watermark: 0, isHeard: true },
    });

    expect(next?.doc).toBe('p2m7');
    expect(next?.entries.map((entry) => entry.seq)).toEqual([1]);
    expect(next?.after).toBe(1);
  });

  it('says the console stopped reporting after two unheard reads that follow a logged entry', () => {
    const once = applyConsoleRead({
      current: READ,
      sent: { doc: 'k3x9', after: 2 },
      answer: { doc: null, entries: [], watermark: 0, isHeard: false },
    });
    const twice =
      once === null
        ? null
        : applyConsoleRead({
            current: once,
            sent: { doc: 'k3x9', after: 2 },
            answer: { doc: null, entries: [], watermark: 0, isHeard: false },
          });

    expect(once?.failure).toBeNull();
    expect(twice?.failure).toBe('silent');
    expect(twice?.entries).toHaveLength(2);
  });

  it('stays quiet about a page that never logged', () => {
    const quiet = applyConsoleRead({
      current: { ...EMPTY_TAB_CONSOLE, misses: 1 },
      sent: { doc: null, after: 0 },
      answer: { doc: null, entries: [], watermark: 0, isHeard: false },
    });

    expect(quiet?.failure).toBeNull();
  });

  it('keeps at most the newest five hundred console rows', () => {
    const many = Array.from({ length: CONSOLE_KEPT_ROWS.console }, (_, index) =>
      line({ seq: index + 3 }),
    );
    const next = applyConsoleRead({
      current: READ,
      sent: { doc: 'k3x9', after: 2 },
      answer: { doc: 'k3x9', entries: many, watermark: 0, isHeard: true },
    });

    expect(next?.entries).toHaveLength(CONSOLE_KEPT_ROWS.console);
    expect(next?.entries[0]?.seq).toBe(3);
  });

  it('keeps each kind to its own cap, so a flood of requests keeps the one error', () => {
    const flood = Array.from({ length: 400 }, (_, index) =>
      request({ seq: index + 4, id: `r${index}`, status: 200 }),
    );
    const next = applyConsoleRead({
      current: { ...READ, entries: [...READ.entries, failure({ seq: 3 })], after: 3 },
      sent: { doc: 'k3x9', after: 3 },
      answer: { doc: 'k3x9', entries: flood, watermark: 0, isHeard: true },
    });

    const kinds = next?.entries.map((entry) => entry.kind) ?? [];
    expect(kinds.filter((kind) => kind === 'console')).toHaveLength(2);
    expect(kinds.filter((kind) => kind === 'error')).toHaveLength(1);
    expect(kinds.filter((kind) => kind === 'network')).toHaveLength(CONSOLE_KEPT_ROWS.network);
    expect(next?.entries.at(-1)?.seq).toBe(403);
  });

  it('replaces a request it already holds where it stands when a newer record comes', () => {
    const current: TabConsole = {
      ...READ,
      after: 4,
      entries: [request({ seq: 3, id: 'r1', status: null }), line({ seq: 4 })],
    };
    const next = applyConsoleRead({
      current,
      sent: { doc: 'k3x9', after: 4 },
      answer: {
        doc: 'k3x9',
        entries: [line({ seq: 5 }), request({ seq: 6, id: 'r1', status: 201 })],
        watermark: 0,
        isHeard: true,
      },
    });

    expect(next?.entries.map((entry) => [entry.seq, entry.status])).toEqual([
      [6, 201],
      [4, null],
      [5, null],
    ]);
    expect(next?.after).toBe(6);
  });
});
