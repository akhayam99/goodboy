import type { SyntaxLang } from './languages';
import type { HighlightRequest, HighlightResponse } from './protocol';
import type { SyntaxLines } from './theme';

export { SYNTAX_CLASS, type SyntaxKind, type SyntaxLines, type SyntaxToken } from './theme';
export { languageForName, languageForPath, type SyntaxLang } from './languages';

type Transport = (request: Omit<HighlightRequest, 'id'>) => Promise<SyntaxLines | null>;

const CACHE_LIMIT = 400;

const inProcess: Transport = (request) =>
  import('./tokenize').then(({ tokenizeCode }) => tokenizeCode(request));

const createWorkerTransport = (): Transport | null => {
  if (typeof Worker !== 'function') {
    return null;
  }
  let worker: Worker;
  try {
    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  } catch {
    return null;
  }
  let nextId = 0;
  let broken = false;
  const pending = new Map<
    number,
    { request: Omit<HighlightRequest, 'id'>; resolve: (lines: SyntaxLines | null) => void }
  >();
  worker.onmessage = (event: MessageEvent<HighlightResponse>) => {
    const entry = pending.get(event.data.id);
    pending.delete(event.data.id);
    entry?.resolve(event.data.lines);
  };
  worker.onerror = () => {
    broken = true;
    worker.terminate();
    for (const entry of pending.values()) {
      void inProcess(entry.request).then(entry.resolve);
    }
    pending.clear();
  };
  return (request) => {
    if (broken) {
      return inProcess(request);
    }
    return new Promise((resolve) => {
      const id = nextId++;
      pending.set(id, { request, resolve });
      worker.postMessage({ id, ...request } satisfies HighlightRequest);
    });
  };
};

let transport: Transport | null = null;

const getTransport = (): Transport => {
  transport ??= createWorkerTransport() ?? inProcess;
  return transport;
};

const inflight = new Map<string, Promise<SyntaxLines | null>>();
const resolved = new Map<string, SyntaxLines | null>();

const cacheKey = (code: string, lang: SyntaxLang): string => `${lang}\u0000${code}`;

const remember = (key: string, lines: SyntaxLines | null) => {
  resolved.delete(key);
  resolved.set(key, lines);
  if (resolved.size <= CACHE_LIMIT) {
    return;
  }
  const oldest = resolved.keys().next().value;
  if (oldest !== undefined) {
    resolved.delete(oldest);
  }
};

export const peekHighlight = (code: string, lang: SyntaxLang): SyntaxLines | null | undefined =>
  resolved.get(cacheKey(code, lang));

export const highlightCode = (code: string, lang: SyntaxLang): Promise<SyntaxLines | null> => {
  const key = cacheKey(code, lang);
  if (resolved.has(key)) {
    return Promise.resolve(resolved.get(key) ?? null);
  }
  const existing = inflight.get(key);
  if (existing) {
    return existing;
  }
  const request = getTransport()({ code, lang })
    .catch(() => null)
    .then((lines) => {
      inflight.delete(key);
      remember(key, lines);
      return lines;
    });
  inflight.set(key, request);
  return request;
};
