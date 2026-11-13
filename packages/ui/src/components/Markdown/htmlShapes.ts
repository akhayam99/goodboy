export type HtmlMedia =
  | { readonly kind: 'image'; readonly alt: string; readonly url: string }
  | { readonly kind: 'video'; readonly url: string };

export type HtmlMediaRead = {
  readonly node: HtmlMedia;
  readonly end: number;
};

export type DetailsRead = {
  readonly summary: string;
  readonly isOpen: boolean;
  readonly body: string;
  readonly next: number;
};

type TextIndexParams = {
  readonly text: string;
  readonly index: number;
};

const ATTRIBUTES = `(?:[ \\t]+[a-zA-Z][a-zA-Z-]{0,23}(?:=(?:"[^"<>\\n]{0,2048}"|'[^'<>\\n]{0,2048}'))?){0,12}`;
const IMG_RE = new RegExp(`<img(${ATTRIBUTES})[ \\t]*/?>`, 'y');
const VIDEO_RE = new RegExp(`<video(${ATTRIBUTES})[ \\t]*/?>(?:[ \\t]*</video>)?`, 'y');
const ATTRIBUTE_RE = /([a-zA-Z][a-zA-Z-]{0,23})=(?:"([^"]*)"|'([^']*)')/g;
const DETAILS_TAG_RE = /<(\/?)(details|summary)( open)?>/y;
const MAX_SOURCE_LENGTH = 2048;
const MAX_ALT_LENGTH = 300;
const MAX_SUMMARY_LENGTH = 300;
const SOURCE_BREAK_RE = /[\s()<>]/;
const HTTPS_RE = /^https:/i;
const DETAILS_OPEN_TEXT = '<details';

type RawParams = {
  readonly raw: string;
};

const attributesOf = ({ raw }: RawParams): ReadonlyMap<string, string> => {
  const found = new Map<string, string>();
  for (const match of raw.matchAll(ATTRIBUTE_RE)) {
    const name = (match[1] ?? '').toLowerCase();
    if (!found.has(name)) {
      found.set(name, match[2] ?? match[3] ?? '');
    }
  }
  return found;
};

type ValueParams = {
  readonly value: string;
};

const decodeAmpersands = ({ value }: ValueParams): string => value.replace(/&amp;/g, '&');

type AttributesParams = {
  readonly attributes: ReadonlyMap<string, string>;
};

const mediaSourceOf = ({ attributes }: AttributesParams): string | null => {
  const raw = attributes.get('src');
  if (raw === undefined) {
    return null;
  }
  const source = decodeAmpersands({ value: raw.trim() });
  if (source.length === 0 || source.length > MAX_SOURCE_LENGTH || SOURCE_BREAK_RE.test(source)) {
    return null;
  }
  return source;
};

const altOf = ({ attributes }: AttributesParams): string =>
  decodeAmpersands({ value: attributes.get('alt') ?? '' })
    .replace(/[[\]\n]/g, ' ')
    .trim()
    .slice(0, MAX_ALT_LENGTH);

export const readHtmlMedia = ({ text, index }: TextIndexParams): HtmlMediaRead | null => {
  if (text[index] !== '<') {
    return null;
  }
  IMG_RE.lastIndex = index;
  const img = IMG_RE.exec(text);
  if (img !== null) {
    const attributes = attributesOf({ raw: img[1] ?? '' });
    const url = mediaSourceOf({ attributes });
    if (url === null) {
      return null;
    }
    return {
      node: { kind: 'image', alt: altOf({ attributes }), url },
      end: index + img[0].length,
    };
  }
  VIDEO_RE.lastIndex = index;
  const video = VIDEO_RE.exec(text);
  if (video !== null) {
    const url = mediaSourceOf({ attributes: attributesOf({ raw: video[1] ?? '' }) });
    if (url === null || !HTTPS_RE.test(url)) {
      return null;
    }
    return { node: { kind: 'video', url }, end: index + video[0].length };
  }
  return null;
};

type DetailsTag = {
  readonly name: 'details' | 'summary';
  readonly isClosing: boolean;
  readonly isOpen: boolean;
  readonly end: number;
};

export const readDetailsTag = ({ text, index }: TextIndexParams): DetailsTag | null => {
  if (text[index] !== '<') {
    return null;
  }
  DETAILS_TAG_RE.lastIndex = index;
  const match = DETAILS_TAG_RE.exec(text);
  if (match === null) {
    return null;
  }
  const isClosing = match[1] === '/';
  const name = match[2] === 'summary' ? 'summary' : 'details';
  const isOpen = match[3] !== undefined;
  if (isOpen && (isClosing || name === 'summary')) {
    return null;
  }
  return { name, isClosing, isOpen, end: index + match[0].length };
};

type LineStartParams = {
  readonly text: string;
  readonly index: number;
};

export const isAtLineStart = ({ text, index }: LineStartParams): boolean => {
  let cursor = index - 1;
  while (cursor >= 0 && (text[cursor] === ' ' || text[cursor] === '\t')) {
    cursor -= 1;
  }
  return cursor < 0 || text[cursor] === '\n';
};

type DetailsParams = {
  readonly lines: ReadonlyArray<string>;
  readonly start: number;
};

const COUNT_TAG_RE = /<(\/?)details(?: open)?>/g;

export const readDetails = ({ lines, start }: DetailsParams): DetailsRead | null => {
  const first = (lines[start] ?? '').trimStart();
  if (!first.startsWith(DETAILS_OPEN_TEXT)) {
    return null;
  }
  const openTag = readDetailsTag({ text: first, index: 0 });
  if (openTag === null || openTag.name !== 'details' || openTag.isClosing) {
    return null;
  }

  let depth = 0;
  const collected: string[] = [];
  let next = lines.length;

  for (let row = start; row < lines.length; row += 1) {
    const raw = row === start ? first.slice(openTag.end) : (lines[row] ?? '');
    if (row === start) {
      depth = 1;
    }
    let closeAt = -1;
    for (const match of raw.matchAll(COUNT_TAG_RE)) {
      depth += match[1] === '/' ? -1 : 1;
      if (depth === 0) {
        closeAt = match.index;
        break;
      }
    }
    if (closeAt >= 0) {
      collected.push(raw.slice(0, closeAt));
      next = row + 1;
      break;
    }
    collected.push(raw);
  }

  const body = collected.join('\n');
  const trimmed = body.trimStart();
  let summary = 'Details';
  let rest = body;
  if (trimmed.startsWith('<summary>')) {
    const close = trimmed.indexOf('</summary>');
    if (close > 0) {
      summary = trimmed.slice('<summary>'.length, close).replace(/\s+/g, ' ').trim();
      rest = trimmed.slice(close + '</summary>'.length);
    }
  }
  return {
    summary: summary.length === 0 ? 'Details' : summary.slice(0, MAX_SUMMARY_LENGTH),
    isOpen: openTag.isOpen,
    body: rest,
    next,
  };
};
