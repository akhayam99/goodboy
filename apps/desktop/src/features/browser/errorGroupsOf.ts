import type { BrowserConsoleEntry, BrowserErrorOrigin } from './types';

export type ErrorFrame = {
  readonly name: string;
  readonly url: string;
  readonly line: number;
  readonly label: string;
};

export type ErrorGroup = {
  readonly key: string;
  readonly text: string;
  readonly origin: BrowserErrorOrigin;
  readonly count: number;
  readonly firstAt: number | null;
  readonly lastAt: number | null;
  readonly frames: ReadonlyArray<ErrorFrame>;
  readonly source: string | null;
  readonly request: BrowserConsoleEntry | null;
};

type Params = {
  readonly entries: ReadonlyArray<BrowserConsoleEntry>;
};

type LineParams = {
  readonly line: string;
};

type StackParams = {
  readonly stack: string | null;
};

type UrlParams = {
  readonly url: string;
};

type TimeParams = {
  readonly known: number | null;
  readonly next: number | null;
};

type RequestParams = {
  readonly entries: ReadonlyArray<BrowserConsoleEntry>;
  readonly requestId: string | null;
};

type NamedLocation = {
  readonly name: string;
  readonly location: string;
};

const isDigits = ({ line }: LineParams): boolean => /^\d+$/.test(line);

const fileNameOf = ({ url }: UrlParams): string => {
  const cut = url.search(/[?#]/);
  const path = cut < 0 ? url : url.slice(0, cut);
  return path.slice(path.lastIndexOf('/') + 1);
};

const splitNameOf = ({ line }: LineParams): NamedLocation => {
  const text = line.startsWith('at ') ? line.slice(3).trim() : line;
  const open = text.lastIndexOf(' (');
  if (open > 0 && text.endsWith(')')) {
    return { name: text.slice(0, open).trim(), location: text.slice(open + 2, -1) };
  }
  const at = text.indexOf('@');
  if (at >= 0 && !text.slice(0, at).includes('/')) {
    return { name: text.slice(0, at), location: text.slice(at + 1) };
  }
  return { name: '', location: text };
};

const frameOf = ({ line }: LineParams): ErrorFrame | null => {
  const { name, location } = splitNameOf({ line: line.trim() });
  const column = location.lastIndexOf(':');
  const lineMark = column > 0 ? location.lastIndexOf(':', column - 1) : -1;
  if (lineMark <= 0) {
    return null;
  }
  const number = location.slice(lineMark + 1, column);
  if (!isDigits({ line: number }) || !isDigits({ line: location.slice(column + 1) })) {
    return null;
  }
  const url = location.slice(0, lineMark);
  const file = fileNameOf({ url });
  if (file === '') {
    return null;
  }
  const lineNumber = Number(number);
  return {
    name: name.replace(/^async /, ''),
    url,
    line: lineNumber,
    label: `${file}:${lineNumber}`,
  };
};

const framesOf = ({ stack }: StackParams): ReadonlyArray<ErrorFrame> =>
  (stack ?? '').split('\n').flatMap((line) => {
    const frame = frameOf({ line });
    return frame === null ? [] : [frame];
  });

const earliestOf = ({ known, next }: TimeParams): number | null => {
  if (known === null || next === null) {
    return known ?? next;
  }
  return Math.min(known, next);
};

const latestOf = ({ known, next }: TimeParams): number | null => {
  if (known === null || next === null) {
    return known ?? next;
  }
  return Math.max(known, next);
};

const requestOf = ({ entries, requestId }: RequestParams): BrowserConsoleEntry | null =>
  requestId === null
    ? null
    : (entries.find((entry) => entry.kind === 'network' && entry.network?.id === requestId) ??
      null);

export const errorGroupsOf = ({ entries }: Params): ReadonlyArray<ErrorGroup> => {
  const groups = new Map<string, ErrorGroup>();
  for (const entry of entries) {
    const { error } = entry;
    if (entry.kind !== 'error' || error === null) {
      continue;
    }
    const frames = framesOf({ stack: error.stack });
    const top = frames[0];
    const place = top === undefined ? (entry.source ?? '') : `${top.url}:${top.line}`;
    const key = `${error.origin === 'request' ? 'request' : 'page'}\n${entry.text}\n${place}`;
    const request = requestOf({ entries, requestId: error.requestId });
    const known = groups.get(key);
    if (known === undefined) {
      groups.set(key, {
        key,
        text: entry.text,
        origin: error.origin,
        count: 1,
        firstAt: error.at,
        lastAt: error.at,
        frames,
        source: entry.source,
        request,
      });
      continue;
    }
    groups.set(key, {
      ...known,
      count: known.count + 1,
      firstAt: earliestOf({ known: known.firstAt, next: error.at }),
      lastAt: latestOf({ known: known.lastAt, next: error.at }),
      request: request ?? known.request,
    });
  }
  return [...groups.values()];
};
