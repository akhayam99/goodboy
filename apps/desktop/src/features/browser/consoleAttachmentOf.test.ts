// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { CONSOLE_SECTION_MAX_CHARS, consoleAttachmentOf } from './consoleAttachmentOf';
import { consoleCounts } from './consoleCounts';
import type { BrowserConsoleEntry } from './types';

const ENTRIES: ReadonlyArray<BrowserConsoleEntry> = [
  {
    seq: 1,
    kind: 'console',
    level: 'error',
    text: 'TypeError: retry is not a function',
    source: 'checkout.js:214',
    method: null,
    status: null,
  },
  {
    seq: 2,
    kind: 'console',
    level: 'log',
    text: 'ledger-core: confirm step mounted token=ghp_abcdefghijklmnopqrstuvwx',
    source: null,
    method: null,
    status: null,
  },
  {
    seq: 3,
    kind: 'network',
    level: 'error',
    text: '/api/orders/confirm',
    source: null,
    method: 'POST',
    status: 500,
  },
  {
    seq: 4,
    kind: 'network',
    level: 'error',
    text: '/logo.png',
    source: null,
    method: 'GET',
    status: 0,
  },
];

describe('the console attachment', () => {
  it('counts each kind from one function', () => {
    expect(consoleCounts({ entries: ENTRIES })).toEqual({ console: 2, network: 2 });
    expect(consoleCounts({ entries: [] })).toEqual({ console: 0, network: 0 });
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
    expect(handoff.text).not.toContain('ghp_abcdefghijklmnopqrstuvwx');
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
    const long: ReadonlyArray<BrowserConsoleEntry> = Array.from({ length: 400 }, (_, index) => ({
      seq: index + 1,
      kind: 'console',
      level: 'log',
      text: `${index + 1} ${'a'.repeat(200)}`,
      source: null,
      method: null,
      status: null,
    }));

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
