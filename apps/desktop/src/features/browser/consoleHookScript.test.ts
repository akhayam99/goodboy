// @vitest-environment node
import { readFileSync } from 'fs';
import { join } from 'path';
import { runInNewContext } from 'vm';
import { describe, expect, it, vi } from 'vitest';

const READ_EVENT = 'goodboy-console-test';

const SCRIPT = readFileSync(
  join(__dirname, '..', '..', '..', 'src-tauri', 'src', 'browser', 'console_hook.js'),
  'utf8',
).replace('__GOODBOY_CONSOLE_READ__', READ_EVENT);

type Listener = (event: object) => void;

type Answer = {
  readonly doc: string;
  readonly entries: ReadonlyArray<{
    readonly seq: number;
    readonly kind: string;
    readonly level: string;
    readonly text: string;
    readonly source: string | null;
    readonly method: string | null;
    readonly status: number | null;
  }>;
};

type ReadParams = {
  readonly doc?: string | null;
  readonly after?: number;
};

type PageParams = {
  readonly isFrame?: boolean;
  readonly fetchAnswer?: () => Promise<{ readonly status: number }>;
};

type FakeXhr = {
  status: number;
  readonly listeners: Map<string, Listener>;
  open: (method: string, address: string) => void;
  send: () => void;
  addEventListener: (type: string, listener: Listener) => void;
};

type FakeWindow = {
  readonly console: object;
  readonly fetch: (input: string, init?: object) => Promise<{ readonly status: number }>;
  readonly XMLHttpRequest: new () => FakeXhr;
  readonly URL: typeof URL;
  readonly location: { readonly href: string; readonly origin: string };
  readonly addEventListener: (type: string, listener: Listener) => void;
  top?: object;
};

type ConsoleCall = (...args: ReadonlyArray<unknown>) => unknown;

type FireParams = {
  readonly type: string;
  readonly event: object;
};

const page = ({ isFrame = false, fetchAnswer }: PageParams = {}) => {
  const listeners = new Map<string, Array<Listener>>();
  const original = {
    log: vi.fn<ConsoleCall>(() => 'logged'),
    info: vi.fn<ConsoleCall>(),
    debug: vi.fn<ConsoleCall>(),
    warn: vi.fn<ConsoleCall>(),
    error: vi.fn<ConsoleCall>(),
  };
  const console = { ...original };
  const fetch = vi.fn(fetchAnswer ?? (() => Promise.resolve({ status: 200 })));
  const XMLHttpRequest = class implements FakeXhr {
    status = 0;
    readonly listeners = new Map<string, Listener>();
    open(): undefined {
      return undefined;
    }
    send(): undefined {
      return undefined;
    }
    addEventListener(type: string, listener: Listener): undefined {
      this.listeners.set(type, listener);
      return undefined;
    }
  };
  const window: FakeWindow = {
    console,
    fetch,
    XMLHttpRequest,
    URL,
    location: { href: 'http://localhost:5173/checkout', origin: 'http://localhost:5173' },
    addEventListener: (type: string, listener: Listener) => {
      listeners.set(type, [...(listeners.get(type) ?? []), listener]);
    },
  };
  window.top = isFrame ? {} : window;
  const ownBefore = Object.getOwnPropertyNames(window).sort();
  runInNewContext(SCRIPT, { window });
  const fire = ({ type, event }: FireParams) => {
    (listeners.get(type) ?? []).forEach((listener) => listener(event));
  };
  const read = ({ doc = null, after = 0 }: ReadParams = {}): Answer | null => {
    const box: { doc: string | null; after: number; answer?: string } = { doc, after };
    fire({ type: READ_EVENT, event: { detail: box, stopImmediatePropagation: () => undefined } });
    if (box.answer === undefined) {
      return null;
    }
    const answer: Answer = JSON.parse(box.answer);
    return answer;
  };
  return { window, console, original, fetch, listeners, fire, read, ownBefore };
};

describe('the console hook', () => {
  it('parses, wraps the console and adds nothing to window', () => {
    const tab = page();

    expect(Object.getOwnPropertyNames(tab.window).sort()).toEqual(tab.ownBefore);
    expect(tab.console.log).not.toBe(tab.original.log);
    expect(tab.window.fetch).not.toBe(tab.fetch);
  });

  it('records one row per level and still runs the page console', () => {
    const tab = page();

    const result = tab.console.log('ledger-core', { step: 'confirm' });
    tab.console.info('info line');
    tab.console.debug('debug line');
    tab.console.warn('Line "Shipping" was rendered twice');
    tab.console.error(new TypeError('retry is not a function'));

    expect(result).toBe('logged');
    expect(tab.original.log).toHaveBeenCalledWith('ledger-core', { step: 'confirm' });
    expect(tab.read()?.entries.map((entry) => [entry.seq, entry.level, entry.text])).toEqual([
      [1, 'log', 'ledger-core {step: "confirm"}'],
      [2, 'info', 'info line'],
      [3, 'log', 'debug line'],
      [4, 'warn', 'Line "Shipping" was rendered twice'],
      [5, 'error', 'TypeError: retry is not a function'],
    ]);
  });

  it('names the file and line that called the console', () => {
    const tab = page();

    tab.console.warn('rendered twice');

    expect(tab.read()?.entries[0]?.source).toMatch(/^consoleHookScript\.test\.ts:\d+$/);
  });

  it('answers only the entries after the cursor of the same load', () => {
    const tab = page();
    ['a', 'b', 'c', 'd'].forEach((text) => tab.console.log(text));
    const first = tab.read();

    const later = tab.read({ doc: first?.doc ?? '', after: 2 });
    const otherLoad = tab.read({ doc: 'stale', after: 2 });

    expect(later?.entries.map((entry) => entry.text)).toEqual(['c', 'd']);
    expect(otherLoad?.entries).toHaveLength(4);
    expect(first?.doc).toMatch(/^[a-z0-9]+$/);
  });

  it('keeps a ring of five hundred entries and drops the oldest', () => {
    const tab = page();
    for (let index = 1; index <= 520; index += 1) {
      tab.console.log(`line ${index}`);
    }

    const entries = tab.read()?.entries ?? [];

    expect(entries).toHaveLength(500);
    expect(entries[0]?.text).toBe('line 21');
    expect(entries[499]?.seq).toBe(520);
  });

  it('stays out of a frame inside the page', () => {
    const tab = page({ isFrame: true });

    expect(tab.console.log).toBe(tab.original.log);
    expect(tab.read()).toBeNull();
  });

  it('records failed requests by method, status and path, never the query', async () => {
    const tab = page({ fetchAnswer: () => Promise.resolve({ status: 500 }) });
    await tab.window.fetch('/api/orders/confirm?token=secret', { method: 'post' });
    await tab.window.fetch('https://api.harborline.dev/v1/rates?key=abc');

    expect(
      tab.read()?.entries.map((entry) => [entry.kind, entry.method, entry.status, entry.text]),
    ).toEqual([
      ['network', 'POST', 500, '/api/orders/confirm'],
      ['network', 'GET', 500, 'api.harborline.dev/v1/rates'],
    ]);
  });

  it('records a rejected fetch as failed and passes the rejection on', async () => {
    const tab = page({ fetchAnswer: () => Promise.reject(new Error('offline')) });
    await expect(tab.window.fetch('/api/cart')).rejects.toThrow('offline');

    expect(tab.read()?.entries.map((entry) => [entry.status, entry.text])).toEqual([
      [0, '/api/cart'],
    ]);
  });

  it('hands the page the rejection with the same reason, observed once', async () => {
    const reason = new Error('offline');
    const rejected = Promise.reject(reason);
    const tab = page({ fetchAnswer: () => rejected });

    const answer = tab.window.fetch('/api/cart');
    const handled = vi.fn();
    await answer.catch(handled);

    expect(handled).toHaveBeenCalledWith(reason);
    expect(tab.read()?.entries).toHaveLength(1);
  });

  it('records a request whose answer is an error status', () => {
    const tab = page();
    const xhr = new tab.window.XMLHttpRequest();

    xhr.open('PUT', '/api/cart/12');
    xhr.send();
    xhr.status = 404;
    xhr.listeners.get('load')?.({});

    expect(tab.read()?.entries.map((entry) => [entry.method, entry.status, entry.text])).toEqual([
      ['PUT', 404, '/api/cart/12'],
    ]);
  });

  it('records a thrown error with its file and line and a resource that failed to load', () => {
    const tab = page();

    tab.fire({
      type: 'error',
      event: {
        target: tab.window,
        message: 'Uncaught ReferenceError: total is not defined',
        filename: 'http://localhost:5173/assets/checkout.js?v=3',
        lineno: 214,
      },
    });
    tab.fire({
      type: 'error',
      event: { target: { nodeName: 'IMG', src: 'http://localhost:5173/logo.png?v=1' } },
    });
    tab.fire({ type: 'unhandledrejection', event: { reason: 'payment declined' } });

    expect(
      tab.read()?.entries.map((entry) => [entry.kind, entry.text, entry.source, entry.status]),
    ).toEqual([
      ['console', 'Uncaught ReferenceError: total is not defined', 'checkout.js:214', null],
      ['network', '/logo.png', null, 0],
      ['console', 'Unhandled rejection: payment declined', null, null],
    ]);
  });

  it('does not record a log written while it describes another one', () => {
    const tab = page();
    const noisy = {
      get total() {
        tab.console.log('inside');
        return 12;
      },
    };

    tab.console.log(noisy);

    expect(tab.read()?.entries.map((entry) => entry.text)).toEqual(['{total: 12}']);
    expect(tab.original.log).toHaveBeenCalledWith('inside');
  });

  it('answers nothing to a read without a box', () => {
    const tab = page();
    tab.console.log('kept');

    expect(() => tab.fire({ type: READ_EVENT, event: { detail: null } })).not.toThrow();
    expect(tab.read()?.entries).toHaveLength(1);
  });
});
