import type {
  BrowserConsoleEntry,
  BrowserConsoleRead,
  BrowserRequestFacts,
  BrowserRequestType,
} from '../../../../../../features/browser/types';

type RequestParams = {
  readonly seq: number;
  readonly method: string;
  readonly text: string;
  readonly type: BrowserRequestType;
  readonly status: number | null;
  readonly size: number | null;
  readonly start: number;
  readonly duration: number | null;
  readonly facts?: Partial<BrowserRequestFacts>;
};

const requestOf = ({
  seq,
  method,
  text,
  type,
  status,
  size,
  start,
  duration,
  facts = {},
}: RequestParams): BrowserConsoleEntry => ({
  seq,
  kind: 'network',
  level: status !== null && (status === 0 || status >= 400) ? 'error' : 'info',
  text,
  source: null,
  method,
  status,
  network: {
    id: `mock-request-${seq}`,
    type,
    start,
    duration,
    size,
    requestHeaders: [],
    responseHeaders: [],
    requestBody: null,
    responseBody: null,
    socket: null,
    phases: null,
    ...facts,
  },
  error: null,
});

const JSON_HEADERS = [{ name: 'content-type', value: 'application/json' }];

export const NETWORK_READ: BrowserConsoleRead = {
  doc: 'mockload',
  watermark: 0,
  isHeard: true,
  entries: [
    requestOf({
      seq: 1,
      method: 'GET',
      text: '/checkout',
      type: 'doc',
      status: null,
      size: 3174,
      start: 0,
      duration: 612,
    }),
    requestOf({
      seq: 2,
      method: 'GET',
      text: '/src/main.tsx',
      type: 'script',
      status: null,
      size: 1228,
      start: 44,
      duration: 8,
    }),
    requestOf({
      seq: 3,
      method: 'GET',
      text: '/src/app.css',
      type: 'style',
      status: null,
      size: 4915,
      start: 46,
      duration: 6,
    }),
    requestOf({
      seq: 4,
      method: 'GET',
      text: '/@vite/hmr',
      type: 'ws',
      status: 101,
      size: null,
      start: 60,
      duration: null,
      facts: { socket: { phase: 'open', sent: 1, received: 3, code: null } },
    }),
    requestOf({
      seq: 5,
      method: 'GET',
      text: '/api/session',
      type: 'fetch',
      status: 304,
      size: 0,
      start: 120,
      duration: 21,
    }),
    requestOf({
      seq: 6,
      method: 'GET',
      text: '/api/cart',
      type: 'fetch',
      status: 200,
      size: 820,
      start: 128,
      duration: 64,
      facts: {
        responseHeaders: JSON_HEADERS,
        responseBody: '{"lines":4,"total":8500}',
        phases: { wait: 51, download: 13 },
      },
    }),
    requestOf({
      seq: 7,
      method: 'GET',
      text: '/api/rates',
      type: 'fetch',
      status: 200,
      size: 1434,
      start: 130,
      duration: 92,
    }),
    requestOf({
      seq: 8,
      method: 'GET',
      text: '/img/ledger.svg',
      type: 'img',
      status: null,
      size: 2253,
      start: 200,
      duration: 12,
    }),
    requestOf({
      seq: 9,
      method: 'POST',
      text: '/api/charge',
      type: 'fetch',
      status: 500,
      size: 38,
      start: 260,
      duration: 380,
      facts: {
        requestHeaders: [...JSON_HEADERS, { name: 'idempotency-key', value: 'ik_7f3a' }],
        responseHeaders: JSON_HEADERS,
        requestBody: '{"amount":8500,"currency":"usd","attempt":2}',
        responseBody: '{"error":"idempotency key reused"}',
        phases: { wait: 304, download: 76 },
      },
    }),
    requestOf({
      seq: 10,
      method: 'POST',
      text: '/api/events',
      type: 'fetch',
      status: 204,
      size: 0,
      start: 650,
      duration: 18,
    }),
  ],
};
