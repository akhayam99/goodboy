// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { errorGroupsOf } from './errorGroupsOf';
import type { BrowserConsoleEntry, BrowserErrorOrigin } from './types';

type ErrorParams = {
  readonly seq: number;
  readonly text: string;
  readonly origin?: BrowserErrorOrigin;
  readonly stack?: string | null;
  readonly at?: number | null;
  readonly requestId?: string | null;
};

const errorOf = ({
  seq,
  text,
  origin = 'uncaught',
  stack = null,
  at = null,
  requestId = null,
}: ErrorParams): BrowserConsoleEntry => ({
  seq,
  kind: 'error',
  level: 'error',
  text,
  source: null,
  method: null,
  status: null,
  network: null,
  error: { origin, stack, requestId, at },
});

const CHROME_RETRY = [
  'TypeError: retry is not a function',
  '    at chargeCard (http://localhost:5173/src/checkout/retry.ts?t=1764150000000:214:9)',
  '    at async onPay (http://localhost:5173/src/checkout/PayButton.tsx:51:5)',
  '    at http://localhost:5173/node_modules/.vite/deps/react-dom.js?v=4f2a:4213:14',
].join('\n');

const WEBKIT_RETRY = [
  'chargeCard@http://localhost:5173/src/checkout/retry.ts?t=1764150000000:214:9',
  'onPay@http://localhost:5173/src/checkout/PayButton.tsx:51:5',
  'http://localhost:5173/@vite/client:12:3',
].join('\n');

const CHARGE: BrowserConsoleEntry = {
  seq: 3,
  kind: 'network',
  level: 'error',
  text: '/api/charge',
  source: null,
  method: 'POST',
  status: 500,
  network: {
    id: 'r-charge',
    type: 'fetch',
    start: 120,
    duration: 380,
    size: 38,
    requestHeaders: [],
    responseHeaders: [],
    requestBody: null,
    responseBody: '{"error":"idempotency key reused"}',
    socket: null,
  },
  error: null,
};

const WARNING: BrowserConsoleEntry = {
  seq: 9,
  kind: 'console',
  level: 'warn',
  text: 'Line "Shipping" was rendered twice',
  source: 'CartLines.tsx:58',
  method: null,
  status: null,
  network: null,
  error: null,
};

describe('errorGroupsOf', () => {
  it('groups the same message at the same frame, counts it and keeps first and last time', () => {
    const groups = errorGroupsOf({
      entries: [
        errorOf({
          seq: 1,
          text: 'TypeError: retry is not a function',
          stack: CHROME_RETRY,
          at: 2_000,
        }),
        errorOf({
          seq: 2,
          text: 'TypeError: retry is not a function',
          stack: CHROME_RETRY,
          at: 1_000,
        }),
        WARNING,
        errorOf({
          seq: 4,
          text: 'TypeError: retry is not a function',
          stack: CHROME_RETRY,
          at: null,
        }),
        errorOf({
          seq: 5,
          text: 'TypeError: retry is not a function',
          stack: CHROME_RETRY,
          at: 9_000,
        }),
      ],
    });

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      text: 'TypeError: retry is not a function',
      origin: 'uncaught',
      count: 4,
      firstAt: 1_000,
      lastAt: 9_000,
    });
  });

  it('splits the same message thrown from another frame', () => {
    const elsewhere = CHROME_RETRY.replace('retry.ts?t=1764150000000:214:9', 'retry.ts:230:3');
    const groups = errorGroupsOf({
      entries: [
        errorOf({ seq: 1, text: 'TypeError: retry is not a function', stack: CHROME_RETRY }),
        errorOf({ seq: 2, text: 'TypeError: retry is not a function', stack: elsewhere }),
      ],
    });

    expect(groups.map((group) => group.frames[0]?.label)).toEqual(['retry.ts:214', 'retry.ts:230']);
  });

  it('splits the same message and frame that came from another origin', () => {
    const groups = errorGroupsOf({
      entries: [
        errorOf({ seq: 1, text: 'Timeout', origin: 'uncaught' }),
        errorOf({ seq: 2, text: 'Timeout', origin: 'console' }),
      ],
    });

    expect(groups.map((group) => [group.origin, group.count])).toEqual([
      ['uncaught', 1],
      ['console', 1],
    ]);
  });

  it('reads Chrome and WebKit frames alike, names and lines kept, the message line dropped', () => {
    const [chrome] = errorGroupsOf({
      entries: [
        errorOf({ seq: 1, text: 'TypeError: retry is not a function', stack: CHROME_RETRY }),
      ],
    });
    const [webkit] = errorGroupsOf({
      entries: [
        errorOf({ seq: 1, text: 'TypeError: retry is not a function', stack: WEBKIT_RETRY }),
      ],
    });

    expect(chrome?.frames.map(({ name, label }) => [name, label])).toEqual([
      ['chargeCard', 'retry.ts:214'],
      ['onPay', 'PayButton.tsx:51'],
      ['', 'react-dom.js:4213'],
    ]);
    expect(webkit?.frames.map(({ name, label }) => [name, label])).toEqual([
      ['chargeCard', 'retry.ts:214'],
      ['onPay', 'PayButton.tsx:51'],
      ['', 'client:12'],
    ]);
    expect(webkit?.frames[0]?.url).toBe(
      'http://localhost:5173/src/checkout/retry.ts?t=1764150000000',
    );
  });

  it('links a failed request to its request and keeps groups in the order they first came', () => {
    const groups = errorGroupsOf({
      entries: [
        errorOf({
          seq: 1,
          text: 'Unhandled rejection: Timeout after 8000 ms',
          origin: 'rejection',
        }),
        CHARGE,
        errorOf({
          seq: 4,
          text: 'POST /api/charge 500',
          origin: 'request',
          requestId: 'r-charge',
        }),
        errorOf({ seq: 5, text: 'POST /api/charge 500', origin: 'request', requestId: 'r-gone' }),
      ],
    });

    expect(groups.map((group) => [group.origin, group.count])).toEqual([
      ['rejection', 1],
      ['request', 2],
    ]);
    expect(groups[1]?.request).toBe(CHARGE);
  });

  it('has no group when the page only warned and logged', () => {
    expect(errorGroupsOf({ entries: [WARNING] })).toEqual([]);
  });
});
