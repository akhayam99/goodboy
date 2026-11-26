import { describe, expect, it } from 'vitest';
import { networkRowsOf } from './networkRowsOf';
import type { BrowserConsoleEntry, BrowserRequestType } from './types';

type RequestParams = {
  readonly seq: number;
  readonly text: string;
  readonly type: BrowserRequestType;
  readonly method?: string;
  readonly status?: number | null;
};

const requestOf = ({
  seq,
  text,
  type,
  method = 'GET',
  status = 200,
}: RequestParams): BrowserConsoleEntry => ({
  seq,
  kind: 'network',
  level: status !== null && (status === 0 || status >= 400) ? 'error' : 'info',
  text,
  source: null,
  method,
  status,
  network: {
    id: `r${seq}`,
    type,
    start: seq * 10,
    duration: 12,
    size: 100,
    requestHeaders: [],
    responseHeaders: [],
    requestBody: null,
    responseBody: null,
    socket: null,
  },
  error: null,
});

const ENTRIES: ReadonlyArray<BrowserConsoleEntry> = [
  requestOf({ seq: 1, text: '/checkout', type: 'doc', status: null }),
  requestOf({ seq: 2, text: '/src/main.tsx', type: 'script' }),
  requestOf({ seq: 3, text: '/src/app.css', type: 'style' }),
  requestOf({ seq: 4, text: '/@vite/hmr', type: 'ws', status: 101 }),
  requestOf({ seq: 5, text: '/api/cart', type: 'fetch' }),
  requestOf({ seq: 6, text: '/api/rates', type: 'xhr' }),
  requestOf({ seq: 7, text: '/img/ledger.svg', type: 'img', status: 0 }),
  requestOf({ seq: 8, text: '/api/charge', type: 'fetch', method: 'POST', status: 500 }),
  requestOf({ seq: 9, text: '/api/ledger-core/events', type: 'sse' }),
  requestOf({ seq: 10, text: '/favicon.ico', type: 'other' }),
  {
    seq: 11,
    kind: 'console',
    level: 'log',
    text: '/api/cart restored',
    source: null,
    method: null,
    status: null,
    network: null,
    error: null,
  },
];

const textsOf = (rows: ReadonlyArray<BrowserConsoleEntry>) => rows.map((row) => row.text);

describe('networkRowsOf', () => {
  it('lists every request and nothing else under All', () => {
    expect(
      networkRowsOf({ entries: ENTRIES, type: 'all', isFailedOnly: false, query: '' }),
    ).toHaveLength(10);
  });

  it.each([
    ['fetch', ['/api/cart', '/api/rates', '/api/charge']],
    ['doc', ['/checkout']],
    ['js', ['/src/main.tsx']],
    ['css', ['/src/app.css']],
    ['img', ['/img/ledger.svg']],
    ['socket', ['/@vite/hmr', '/api/ledger-core/events']],
  ] as const)('keeps only the %s requests', (type, texts) => {
    expect(
      textsOf(networkRowsOf({ entries: ENTRIES, type, isFailedOnly: false, query: '' })),
    ).toEqual(texts);
  });

  it('keeps only failed requests, a status of 0 or 400 and up, never one without a status', () => {
    expect(
      textsOf(networkRowsOf({ entries: ENTRIES, type: 'all', isFailedOnly: true, query: '' })),
    ).toEqual(['/img/ledger.svg', '/api/charge']);
  });

  it('matches every word of the filter on path, method and status together with the type', () => {
    expect(
      textsOf(
        networkRowsOf({ entries: ENTRIES, type: 'fetch', isFailedOnly: false, query: 'post 500' }),
      ),
    ).toEqual(['/api/charge']);
    expect(
      textsOf(networkRowsOf({ entries: ENTRIES, type: 'js', isFailedOnly: false, query: 'api' })),
    ).toEqual([]);
  });
});
