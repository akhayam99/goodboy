// @vitest-environment node
import { readFileSync } from 'fs';
import { join } from 'path';
import { runInNewContext } from 'vm';
import { describe, expect, it, vi } from 'vitest';

const READ_EVENT = 'goodboy-console-test';

const BROWSER_DIR = join(__dirname, '..', '..', '..', 'src-tauri', 'src', 'browser');

const RUST = readFileSync(join(BROWSER_DIR, 'console.rs'), 'utf8');

const JOINED_FROM = RUST.indexOf('const RUNTIME: &str = concat!(');

const JOINED = RUST.slice(JOINED_FROM, RUST.indexOf('\n);', JOINED_FROM));

type PartParams = {
  readonly match: RegExpMatchArray;
};

const partOf = ({ match }: PartParams): string => {
  const file = match[1];
  if (file !== undefined) {
    return readFileSync(join(BROWSER_DIR, file), 'utf8');
  }
  const text: unknown = JSON.parse(`"${match[2] ?? ''}"`);
  return typeof text === 'string' ? text : '';
};

const SCRIPT = [...JOINED.matchAll(/include_str!\("([^"]+)"\)|"((?:[^"\\]|\\.)*)"/g)]
  .map((match) => partOf({ match }))
  .join('')
  .replace('__GOODBOY_CONSOLE_READ__', READ_EVENT);

type Listener = (event: object) => void;

type Header = {
  readonly name: string;
  readonly value: string;
};

type Entry = {
  readonly seq: number;
  readonly kind: string;
  readonly level: string;
  readonly text: string;
  readonly source: string | null;
  readonly method: string | null;
  readonly status: number | null;
  readonly network: {
    readonly id: string;
    readonly type: string;
    readonly start: number;
    readonly duration: number | null;
    readonly size: number | null;
    readonly requestHeaders: ReadonlyArray<Header>;
    readonly responseHeaders: ReadonlyArray<Header>;
    readonly requestBody: string | null;
    readonly responseBody: string | null;
    readonly socket: {
      readonly phase: string;
      readonly sent: number;
      readonly received: number;
      readonly code: number | null;
    } | null;
  } | null;
  readonly error: {
    readonly origin: string;
    readonly stack: string | null;
    readonly requestId: string | null;
  } | null;
};

type Answer = {
  readonly doc: string;
  readonly entries: ReadonlyArray<Entry>;
};

type ReadParams = {
  readonly doc?: string | null;
  readonly after?: number;
};

type PageParams = {
  readonly isFrame?: boolean;
  readonly fetchAnswer?: () => Promise<object>;
};

type FakeXhr = {
  status: number;
  responseType: string;
  responseText: string;
  responseHeaderText: string;
  readonly sentHeaders: Array<readonly [string, string]>;
  readonly listeners: Map<string, Listener>;
  open: (method: string, address: string) => void;
  send: (body?: unknown) => void;
  setRequestHeader: (name: string, value: string) => void;
  getAllResponseHeaders: () => string;
  addEventListener: (type: string, listener: Listener) => void;
};

type FakeTarget = {
  readonly address: string;
  readonly listeners: Map<string, Array<Listener>>;
  readyState: number;
  emit: (type: string, event?: object) => void;
};

type FakeSocket = FakeTarget & {
  readonly frames: Array<unknown>;
  send: (frame: unknown) => void;
};

type FakeWindow = {
  readonly console: object;
  readonly fetch: (input: string, init?: object) => Promise<object>;
  readonly XMLHttpRequest: new () => FakeXhr;
  readonly WebSocket: new (address: string) => FakeSocket;
  readonly EventSource: new (address: string) => FakeTarget & { close: () => void };
  readonly PerformanceObserver: new (watch: (list: object) => void) => object;
  readonly TextDecoder: typeof TextDecoder;
  readonly URL: typeof URL;
  readonly URLSearchParams: typeof URLSearchParams;
  readonly performance: { readonly now: () => number };
  readonly location: { readonly href: string; readonly origin: string };
  readonly addEventListener: (type: string, listener: Listener) => void;
  top?: object;
};

type ConsoleCall = (...args: ReadonlyArray<unknown>) => unknown;

type FireParams = {
  readonly type: string;
  readonly event: object;
};

type TimingParams = {
  readonly type: string;
  readonly items: ReadonlyArray<object>;
};

const fakeTargetClass = () =>
  class {
    readonly listeners = new Map<string, Array<Listener>>();
    readyState = 0;
    constructor(readonly address: string) {}
    addEventListener(type: string, listener: Listener): undefined {
      this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
      return undefined;
    }
    emit(type: string, event: object = {}): undefined {
      (this.listeners.get(type) ?? []).forEach((listener) => listener(event));
      return undefined;
    }
  };

const page = ({ isFrame = false, fetchAnswer }: PageParams = {}) => {
  const listeners = new Map<string, Array<Listener>>();
  const timings = new Map<string, (list: object) => void>();
  const clock = { at: 100 };
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
    responseType = '';
    responseText = '';
    responseHeaderText = '';
    readonly sentHeaders: Array<readonly [string, string]> = [];
    readonly listeners = new Map<string, Listener>();
    open(): undefined {
      return undefined;
    }
    send(): undefined {
      return undefined;
    }
    setRequestHeader(name: string, value: string): undefined {
      this.sentHeaders.push([name, value]);
      return undefined;
    }
    getAllResponseHeaders(): string {
      return this.responseHeaderText;
    }
    addEventListener(type: string, listener: Listener): undefined {
      this.listeners.set(type, listener);
      return undefined;
    }
  };
  const WebSocket = class extends fakeTargetClass() implements FakeSocket {
    readonly frames: Array<unknown> = [];
    send(frame: unknown): undefined {
      this.frames.push(frame);
      return undefined;
    }
  };
  const EventSource = class extends fakeTargetClass() {
    close(): undefined {
      this.readyState = 2;
      return undefined;
    }
  };
  const PerformanceObserver = class {
    constructor(readonly watch: (list: object) => void) {}
    observe({ type }: { readonly type: string }): undefined {
      timings.set(type, this.watch);
      return undefined;
    }
  };
  const window: FakeWindow = {
    console,
    fetch,
    XMLHttpRequest,
    WebSocket,
    EventSource,
    PerformanceObserver,
    TextDecoder,
    URL,
    URLSearchParams,
    performance: { now: () => clock.at },
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
  const time = ({ type, items }: TimingParams) => {
    timings.get(type)?.({ getEntries: () => items });
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
  const entries = (): ReadonlyArray<Entry> => read()?.entries ?? [];
  const ofKind = ({ kind }: { readonly kind: string }): ReadonlyArray<Entry> =>
    entries().filter((entry) => entry.kind === kind);
  return {
    window,
    console,
    original,
    fetch,
    listeners,
    clock,
    fire,
    time,
    read,
    entries,
    ofKind,
    ownBefore,
  };
};

const namesOf = ({ headers }: { readonly headers: ReadonlyArray<Header> | undefined }) =>
  (headers ?? []).map((header) => header.name);

describe('the page runtime', () => {
  it('is one closure built from the modules console.rs joins', () => {
    expect(SCRIPT.startsWith('(() => {\n  if (window.top !== window) {')).toBe(true);
    expect(SCRIPT.endsWith('})();\n')).toBe(true);
    expect(SCRIPT).toContain('const RING_SIZES = { console: 500, network: 300, error: 100 };');
  });

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
    expect(tab.entries().map((entry) => [entry.seq, entry.kind, entry.level, entry.text])).toEqual([
      [1, 'console', 'log', 'ledger-core {step: "confirm"}'],
      [2, 'console', 'info', 'info line'],
      [3, 'console', 'log', 'debug line'],
      [4, 'console', 'warn', 'Line "Shipping" was rendered twice'],
      [5, 'error', 'error', 'TypeError: retry is not a function'],
    ]);
  });

  it('names the file and line that called the console', () => {
    const tab = page();

    tab.console.warn('rendered twice');

    expect(tab.entries()[0]?.source).toMatch(/^consoleHookScript\.test\.ts:\d+$/);
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

  it('keeps a ring of five hundred console lines and drops the oldest', () => {
    const tab = page();
    for (let index = 1; index <= 520; index += 1) {
      tab.console.log(`line ${index}`);
    }

    const entries = tab.entries();

    expect(entries).toHaveLength(500);
    expect(entries[0]?.text).toBe('line 21');
    expect(entries[499]?.seq).toBe(520);
  });

  it('keeps each kind in its own ring, so requests never push the one error out', async () => {
    const tab = page();
    tab.console.log('ledger-core mounted');
    tab.fire({
      type: 'error',
      event: { target: tab.window, message: 'Uncaught TypeError: total is undefined' },
    });
    for (let index = 1; index <= 640; index += 1) {
      await tab.window.fetch(`/@vite/hmr-${index}`);
    }

    expect(tab.ofKind({ kind: 'console' }).map((entry) => entry.text)).toEqual([
      'ledger-core mounted',
    ]);
    expect(tab.ofKind({ kind: 'error' }).map((entry) => entry.text)).toEqual([
      'Uncaught TypeError: total is undefined',
    ]);
    expect(tab.ofKind({ kind: 'network' })).toHaveLength(300);
    expect(tab.ofKind({ kind: 'network' })[0]?.text).toBe('/@vite/hmr-341');
  });

  it('keeps the newest hundred errors', () => {
    const tab = page();
    for (let index = 1; index <= 130; index += 1) {
      tab.console.error(`Acme widget ${index} failed`);
    }

    const errors = tab.ofKind({ kind: 'error' });

    expect(errors).toHaveLength(100);
    expect(errors[0]?.text).toBe('Acme widget 31 failed');
  });

  it('stays out of a frame inside the page', () => {
    const tab = page({ isFrame: true });

    expect(tab.console.log).toBe(tab.original.log);
    expect(tab.read()).toBeNull();
  });

  it('records requests by method, status and path, never the query', async () => {
    const tab = page({ fetchAnswer: () => Promise.resolve({ status: 500 }) });
    await tab.window.fetch('/api/orders/confirm?token=secret', { method: 'post' });
    await tab.window.fetch('https://api.harborline.dev/v1/rates?key=abc');

    expect(
      tab
        .ofKind({ kind: 'network' })
        .map((entry) => [entry.method, entry.status, entry.text, entry.network?.type]),
    ).toEqual([
      ['POST', 500, '/api/orders/confirm', 'fetch'],
      ['GET', 500, 'api.harborline.dev/v1/rates', 'fetch'],
    ]);
  });

  it('links an error record to every failed request', async () => {
    const tab = page({ fetchAnswer: () => Promise.resolve({ status: 502 }) });
    await tab.window.fetch('/api/orders', { method: 'PUT' });

    const [request] = tab.ofKind({ kind: 'network' });
    expect(tab.ofKind({ kind: 'error' }).map((entry) => [entry.text, entry.error])).toEqual([
      ['PUT /api/orders 502', { origin: 'request', stack: null, requestId: request?.network?.id }],
    ]);
    expect(request?.network?.id).toMatch(/^r\d+$/);
  });

  it('records an opaque answer without a status, never as a failure', async () => {
    const tab = page({ fetchAnswer: () => Promise.resolve({ status: 0, type: 'opaque' }) });
    await tab.window.fetch('https://cdn.acme.dev/pixel', { mode: 'no-cors' });

    expect(tab.ofKind({ kind: 'network' }).map((entry) => [entry.status, entry.level])).toEqual([
      [null, 'info'],
    ]);
    expect(tab.ofKind({ kind: 'error' })).toHaveLength(0);
  });

  it('records a rejected fetch as failed and passes the rejection on', async () => {
    const tab = page({ fetchAnswer: () => Promise.reject(new Error('offline')) });
    await expect(tab.window.fetch('/api/cart')).rejects.toThrow('offline');

    expect(tab.ofKind({ kind: 'network' }).map((entry) => [entry.status, entry.text])).toEqual([
      [0, '/api/cart'],
    ]);
    expect(tab.ofKind({ kind: 'error' }).map((entry) => entry.text)).toEqual([
      'GET /api/cart failed',
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
    expect(tab.ofKind({ kind: 'network' })).toHaveLength(1);
  });

  it('keeps headers and text bodies of a fetch and never the sensitive headers', async () => {
    const tab = page({
      fetchAnswer: () =>
        Promise.resolve(
          new Response('{"total":42}', {
            status: 201,
            headers: {
              'content-type': 'application/json',
              'x-api-key': 'k_live',
              'x-request-id': 'northwind-7',
            },
          }),
        ),
    });
    tab.clock.at = 250;

    const response = await tab.window.fetch('/api/orders', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer abc',
        Cookie: 'sid=1',
        'Content-Type': 'application/json',
      },
      body: '{"cart":12}',
    });

    await vi.waitFor(() =>
      expect(tab.ofKind({ kind: 'network' })[0]?.network?.responseBody).toBe('{"total":42}'),
    );
    expect(response).toBeInstanceOf(Response);
    const [entry] = tab.ofKind({ kind: 'network' });
    expect(entry?.status).toBe(201);
    expect(namesOf({ headers: entry?.network?.requestHeaders })).toEqual(['content-type']);
    expect(namesOf({ headers: entry?.network?.responseHeaders })).toEqual([
      'content-type',
      'x-request-id',
    ]);
    expect(entry?.network?.requestBody).toBe('{"cart":12}');
    expect(entry?.network?.size).toBe(12);
    expect(entry?.network?.start).toBe(250);
    expect(tab.entries()).toHaveLength(1);
  });

  it('cuts a body at 64 kB and skips a body that is not text or JSON', async () => {
    const big = 'a'.repeat(70_000);
    const tab = page({
      fetchAnswer: () =>
        Promise.resolve(new Response(big, { headers: { 'content-type': 'text/plain' } })),
    });
    await tab.window.fetch('/notes.txt');
    await vi.waitFor(() =>
      expect(tab.ofKind({ kind: 'network' })[0]?.network?.responseBody?.length).toBe(65_536),
    );

    const image = page({
      fetchAnswer: () =>
        Promise.resolve(new Response('png', { headers: { 'content-type': 'image/png' } })),
    });
    await image.window.fetch('/logo.png', { method: 'POST', body: new Uint8Array([1, 2]) });
    expect(image.ofKind({ kind: 'network' })[0]?.network?.responseBody).toBeNull();
    expect(image.ofKind({ kind: 'network' })[0]?.network?.requestBody).toBeNull();
  });

  it('records a request whose answer is an error status', () => {
    const tab = page();
    const xhr = new tab.window.XMLHttpRequest();

    xhr.open('PUT', '/api/cart/12');
    xhr.send();
    xhr.status = 404;
    xhr.listeners.get('load')?.({});

    expect(
      tab.ofKind({ kind: 'network' }).map((entry) => [entry.method, entry.status, entry.text]),
    ).toEqual([['PUT', 404, '/api/cart/12']]);
  });

  it('keeps the headers and text body of an XMLHttpRequest without the sensitive ones', () => {
    const tab = page();
    const xhr = new tab.window.XMLHttpRequest();

    xhr.open('POST', '/api/rates');
    xhr.setRequestHeader('Authorization', 'Bearer abc');
    xhr.setRequestHeader('X-Tenant', 'cascadia');
    xhr.send(new URLSearchParams({ plan: 'team' }));
    xhr.status = 200;
    xhr.responseHeaderText = 'Content-Type: application/json\r\nSet-Cookie: sid=1\r\n';
    xhr.responseText = '{"rate":3}';
    xhr.listeners.get('load')?.({});

    const [entry] = tab.ofKind({ kind: 'network' });
    expect(xhr.sentHeaders).toHaveLength(2);
    expect(entry?.network?.type).toBe('xhr');
    expect(entry?.network?.requestHeaders).toEqual([{ name: 'x-tenant', value: 'cascadia' }]);
    expect(entry?.network?.responseHeaders).toEqual([
      { name: 'content-type', value: 'application/json' },
    ]);
    expect(entry?.network?.requestBody).toBe('plan=team');
    expect(entry?.network?.responseBody).toBe('{"rate":3}');
  });

  it('records a socket when it opens and again when it closes, with its frame counts', () => {
    const tab = page();
    const socket = new tab.window.WebSocket('ws://localhost:5173/notify-relay');

    socket.emit('open');
    socket.send('hello');
    socket.emit('message', { data: 'a' });
    socket.emit('message', { data: 'b' });
    const opened = tab.ofKind({ kind: 'network' });
    socket.emit('close', { code: 1000 });

    expect(socket).toBeInstanceOf(tab.window.WebSocket);
    expect(socket.frames).toEqual(['hello']);
    expect(opened.map((entry) => [entry.status, entry.network?.socket?.phase])).toEqual([
      [101, 'open'],
    ]);
    const closed = tab.ofKind({ kind: 'network' });
    expect(closed).toHaveLength(1);
    expect(closed[0]?.network?.type).toBe('ws');
    expect(closed[0]?.network?.socket).toEqual({
      phase: 'closed',
      sent: 1,
      received: 2,
      code: 1000,
    });
    expect(tab.ofKind({ kind: 'error' })).toHaveLength(0);
  });

  it('records a socket that never opened as a failed request', () => {
    const tab = page();
    const socket = new tab.window.WebSocket('ws://localhost:5173/notify-relay');

    socket.emit('close', { code: 1006 });

    expect(tab.ofKind({ kind: 'network' })[0]?.status).toBe(0);
    expect(tab.ofKind({ kind: 'error' })[0]?.error?.origin).toBe('request');
  });

  it('records an event stream when it opens and when it closes', () => {
    const tab = page();
    const stream = new tab.window.EventSource('/api/ledger-core/events');

    stream.emit('open');
    stream.emit('message', { data: 'x' });
    stream.close();

    const [entry] = tab.ofKind({ kind: 'network' });
    expect(entry?.network?.type).toBe('sse');
    expect(entry?.status).toBe(200);
    expect(entry?.network?.socket).toEqual({ phase: 'closed', sent: 0, received: 1, code: null });
  });

  it('fills static resources and the document from resource timing, without a status', () => {
    const tab = page();

    tab.time({
      type: 'resource',
      items: [
        {
          name: 'http://localhost:5173/src/main.tsx',
          initiatorType: 'script',
          startTime: 12,
          duration: 8,
          encodedBodySize: 900,
        },
        {
          name: 'http://localhost:5173/assets/app.css',
          initiatorType: 'link',
          startTime: 14,
          duration: 3,
          transferSize: 0,
        },
        {
          name: 'http://localhost:5173/api/cart',
          initiatorType: 'fetch',
          startTime: 15,
          duration: 3,
        },
      ],
    });
    tab.time({
      type: 'navigation',
      items: [
        {
          name: 'http://localhost:5173/checkout',
          initiatorType: 'navigation',
          startTime: 0,
          duration: 40,
        },
      ],
    });

    expect(
      tab
        .ofKind({ kind: 'network' })
        .map((entry) => [
          entry.text,
          entry.status,
          entry.network?.type,
          entry.network?.start,
          entry.network?.duration,
          entry.network?.size,
        ]),
    ).toEqual([
      ['/src/main.tsx', null, 'script', 12, 8, 900],
      ['/assets/app.css', null, 'style', 14, 3, null],
      ['/checkout', null, 'doc', 0, 40, null],
    ]);
  });

  it('skips a timing it cannot read and keeps the rest of the batch', () => {
    const tab = page();
    const broken = {
      name: 'http://localhost:5173/broken.js',
      get initiatorType(): string {
        throw new Error('Acme getter');
      },
    };

    expect(() =>
      tab.time({
        type: 'resource',
        items: [broken, { name: 'http://localhost:5173/logo.svg', initiatorType: 'img' }],
      }),
    ).not.toThrow();
    expect(tab.ofKind({ kind: 'network' }).map((entry) => entry.text)).toEqual(['/logo.svg']);
    expect(tab.ofKind({ kind: 'error' })).toHaveLength(0);
  });

  it('records thrown errors and rejections with their stack, and a resource that failed to load', () => {
    const tab = page();
    const thrown = new TypeError('total is not defined');
    thrown.stack =
      'TypeError: total is not defined\n    at confirm (http://localhost:5173/assets/checkout.js:214:9)';

    tab.fire({
      type: 'error',
      event: {
        target: tab.window,
        message: 'Uncaught ReferenceError: total is not defined',
        filename: 'http://localhost:5173/assets/checkout.js?v=3',
        lineno: 214,
        error: thrown,
      },
    });
    tab.fire({
      type: 'error',
      event: { target: { nodeName: 'IMG', src: 'http://localhost:5173/logo.png?v=1' } },
    });
    tab.fire({ type: 'unhandledrejection', event: { reason: 'payment declined' } });

    expect(
      tab
        .entries()
        .map((entry) => [
          entry.kind,
          entry.text,
          entry.source,
          entry.status,
          entry.error?.origin ?? null,
        ]),
    ).toEqual([
      [
        'error',
        'Uncaught ReferenceError: total is not defined',
        'checkout.js:214',
        null,
        'uncaught',
      ],
      ['network', '/logo.png', null, 0, null],
      ['error', 'GET /logo.png failed', null, null, 'request'],
      ['error', 'Unhandled rejection: payment declined', null, null, 'rejection'],
    ]);
    expect(tab.entries()[0]?.error?.stack).toBe(
      'TypeError: total is not defined\nat confirm (http://localhost:5173/assets/checkout.js:214:9)',
    );
    expect(tab.entries()[1]?.network?.type).toBe('img');
  });

  it('keeps the call stack of a console error', () => {
    const tab = page();

    tab.console.error('Northwind sync failed');

    expect(tab.entries()[0]?.error?.origin).toBe('console');
    expect(tab.entries()[0]?.error?.stack).toMatch(/consoleHookScript\.test\.ts:\d+/);
  });

  it('handles the host refusal of the notification shim in a tab and records nothing for it', () => {
    const tab = page();
    const refused = vi.fn();
    const declined = vi.fn();

    tab.fire({
      type: 'unhandledrejection',
      event: {
        reason: 'Command plugin:notification|is_permission_granted not allowed by ACL',
        preventDefault: refused,
      },
    });
    tab.fire({
      type: 'unhandledrejection',
      event: {
        reason: 'notification.is_permission_granted not allowed on window "browse-0f1e"',
        preventDefault: refused,
      },
    });
    tab.fire({
      type: 'unhandledrejection',
      event: { reason: 'payment declined', preventDefault: declined },
    });
    tab.fire({
      type: 'unhandledrejection',
      event: { reason: 'Acme document update not allowed by ACL', preventDefault: declined },
    });
    tab.fire({
      type: 'unhandledrejection',
      event: {
        reason: 'Harborline seat not allowed on window "checkout"',
        preventDefault: declined,
      },
    });

    expect(refused).toHaveBeenCalledTimes(2);
    expect(declined).not.toHaveBeenCalled();
    expect(tab.entries().map((entry) => entry.text)).toEqual([
      'Unhandled rejection: payment declined',
      'Unhandled rejection: Acme document update not allowed by ACL',
      'Unhandled rejection: Harborline seat not allowed on window "checkout"',
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

    expect(tab.entries().map((entry) => entry.text)).toEqual(['{total: 12}']);
    expect(tab.original.log).toHaveBeenCalledWith('inside');
  });

  it('splits a large answer so the next read picks up after it', () => {
    const tab = page();
    for (let index = 1; index <= 800; index += 1) {
      tab.console.log(`${index} ${'x'.repeat(1_900)}`);
    }

    const first = tab.read();
    const last = first?.entries.at(-1)?.seq ?? 0;
    const rest = tab.read({ doc: first?.doc ?? '', after: last });

    expect(first?.entries.length).toBeLessThan(500);
    expect((first?.entries.length ?? 0) + (rest?.entries.length ?? 0)).toBe(500);
    expect(rest?.entries.at(-1)?.seq).toBe(800);
  });

  it('answers nothing to a read without a box', () => {
    const tab = page();
    tab.console.log('kept');

    expect(() => tab.fire({ type: READ_EVENT, event: { detail: null } })).not.toThrow();
    expect(tab.entries()).toHaveLength(1);
  });
});
