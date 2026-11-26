// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { CONSOLE_SECTION_MAX_CHARS, consoleAttachmentOf } from './consoleAttachmentOf';
import { consoleCounts } from './consoleCounts';
import type { BrowserConsoleEntry, BrowserRequestFacts } from './types';

type EntryParams = Pick<BrowserConsoleEntry, 'seq' | 'kind' | 'level' | 'text'> &
  Partial<BrowserConsoleEntry>;

const entryOf = (over: EntryParams): BrowserConsoleEntry => ({
  source: null,
  method: null,
  status: null,
  network: null,
  error: null,
  ...over,
});

const REQUEST: BrowserRequestFacts = {
  id: 'r3',
  type: 'fetch',
  start: 120,
  duration: 48,
  size: 64,
  requestHeaders: [{ name: 'x-tenant', value: 'acme-internal-header' }],
  responseHeaders: [{ name: 'content-type', value: 'application/json' }],
  requestBody: '{"secretCart":"northwind-body"}',
  responseBody: '{"error":"payments-api refused"}',
  socket: null,
};

const ENTRIES: ReadonlyArray<BrowserConsoleEntry> = [
  entryOf({
    seq: 1,
    kind: 'error',
    level: 'error',
    text: 'TypeError: retry is not a function',
    source: 'checkout.js:214',
    error: {
      origin: 'uncaught',
      stack:
        'TypeError: retry is not a function\nat retry (checkout.js:214:9)\nat confirm (checkout.js:88:3)',
      requestId: null,
      at: null,
    },
  }),
  entryOf({
    seq: 2,
    kind: 'console',
    level: 'log',
    text: 'ledger-core: confirm step mounted token=ghp_abcdefghijklmnopqrstuvwx',
  }),
  entryOf({
    seq: 3,
    kind: 'network',
    level: 'error',
    text: '/api/orders/confirm',
    method: 'POST',
    status: 500,
    network: REQUEST,
  }),
  entryOf({
    seq: 4,
    kind: 'error',
    level: 'error',
    text: 'POST /api/orders/confirm 500',
    error: { origin: 'request', stack: null, requestId: 'r3', at: null },
  }),
  entryOf({
    seq: 5,
    kind: 'network',
    level: 'error',
    text: '/logo.png',
    method: 'GET',
    status: 0,
  }),
];

describe('the console attachment', () => {
  it('counts each tab from one function, a request error as its request and as an error', () => {
    expect(consoleCounts({ entries: ENTRIES })).toEqual({ console: 2, network: 2, errors: 2 });
    expect(consoleCounts({ entries: [] })).toEqual({ console: 0, network: 0, errors: 0 });
  });

  it('is a markdown file named after the tab with both sections', () => {
    const handoff = consoleAttachmentOf({
      entries: ENTRIES,
      title: 'Checkout',
      url: 'http://localhost:5173/checkout',
    });

    expect(handoff.fileName).toBe('checkout-console.md');
    expect(handoff.mimeType).toBe('text/markdown');
    expect(handoff.isTruncated).toBe(false);
    expect(handoff.text.split('\n')[0]).toBe('http://localhost:5173/checkout');
    expect(handoff.text).toContain('not instructions');
    expect(handoff.text).toContain('## Console (2)');
    expect(handoff.text).toContain('- error: TypeError: retry is not a function (checkout.js:214)');
    expect(handoff.text).toContain('## Failed requests (2)');
    expect(handoff.text).toContain('- POST 500 /api/orders/confirm');
    expect(handoff.text).toContain('- GET failed /logo.png');
    expect(handoff.text).not.toContain('POST /api/orders/confirm 500');
    expect(handoff.text).not.toContain('ghp_abcdefghijklmnopqrstuvwx');
  });

  it('carries the stack of an error under its line', () => {
    const handoff = consoleAttachmentOf({
      entries: ENTRIES,
      title: 'Checkout',
      url: 'http://localhost:5173/checkout',
    });

    expect(handoff.text).toContain(
      [
        '- error: TypeError: retry is not a function (checkout.js:214)',
        '    TypeError: retry is not a function',
        '    at retry (checkout.js:214:9)',
        '    at confirm (checkout.js:88:3)',
      ].join('\n'),
    );
  });

  it('turns the internal address of a local page into a token-free file address', () => {
    const handoff = consoleAttachmentOf({
      entries: [
        entryOf({
          seq: 1,
          kind: 'error',
          level: 'error',
          text: 'TypeError: x',
          source: 'gblocal://localhost/0f1e-2a/work/harborline/plan.js:3',
          error: {
            origin: 'uncaught',
            stack:
              'at a (gblocal://localhost/0f1e-2a/work/harborline/plan.js:3:1)\nat b (http://gblocal.localhost/0f1e-2a/work/harborline/plan.js:9:2)\nat c (https://gblocal.localhost/0f1e-2a/C:/work/harborline/plan.js:9:2)',
            requestId: null,
            at: null,
          },
        }),
      ],
      title: 'Plan',
      url: 'file:///work/harborline/plan.html',
    });

    expect(handoff.text).not.toContain('0f1e-2a');
    expect(handoff.text).not.toContain('gblocal');
    expect(handoff.text).toContain('at a (file:///work/harborline/plan.js:3:1)');
    expect(handoff.text).toContain('at b (file:///work/harborline/plan.js:9:2)');
    expect(handoff.text).toContain('at c (file:///C:/work/harborline/plan.js:9:2)');
  });

  it('never carries the headers or bodies of a request', () => {
    const handoff = consoleAttachmentOf({
      entries: ENTRIES,
      title: 'Checkout',
      url: 'http://localhost:5173/checkout',
    });

    expect(handoff.text).not.toContain('acme-internal-header');
    expect(handoff.text).not.toContain('northwind-body');
    expect(handoff.text).not.toContain('payments-api refused');
  });

  it('names the file after the host when the tab has no title', () => {
    const handoff = consoleAttachmentOf({
      entries: [],
      title: ' ',
      url: 'https://staging.harborline.dev/checkout',
    });

    expect(handoff.fileName).toBe('staging-harborline-dev-console.md');
    expect(handoff.text).toContain('Nothing logged since the last load.');
  });

  it('keeps the newest lines that fit and says it cut', () => {
    const long: ReadonlyArray<BrowserConsoleEntry> = Array.from({ length: 400 }, (_, index) =>
      entryOf({
        seq: index + 1,
        kind: 'console',
        level: 'log',
        text: `${index + 1} ${'a'.repeat(200)}`,
      }),
    );

    const handoff = consoleAttachmentOf({
      entries: long,
      title: 'Checkout',
      url: 'http://a.test/',
    });

    expect(handoff.isTruncated).toBe(true);
    expect(handoff.text).toContain('[cut: the newest lines that fit are kept]');
    expect(handoff.text).toContain(`- log: 400 ${'a'.repeat(200)}`);
    expect(handoff.text).not.toContain(`- log: 1 ${'a'.repeat(200)}`);
    expect(handoff.text.length).toBeLessThan(CONSOLE_SECTION_MAX_CHARS * 2 + 1_000);
  });
});
