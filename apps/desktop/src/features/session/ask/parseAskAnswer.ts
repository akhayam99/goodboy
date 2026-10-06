import { decodeAskHandle, encodeAskHandle, fileHandleOf, type AskHandle } from './askHandles';

export type AskInline =
  | { readonly kind: 'text'; readonly text: string; readonly isBold: boolean }
  | { readonly kind: 'chip'; readonly handle: AskHandle };

export type AskBlock = {
  readonly kind: 'paragraph' | 'item';
  readonly inlines: ReadonlyArray<AskInline>;
};

type AskSuggestion = {
  readonly handle: AskHandle;
  readonly text: string;
};

export type ParsedAskAnswer = {
  readonly blocks: ReadonlyArray<AskBlock>;
  readonly cited: ReadonlyArray<AskHandle>;
  readonly suggestion: AskSuggestion | null;
};

type Params = {
  readonly text: string;
  readonly handles: ReadonlyArray<AskHandle>;
};

const SUGGEST = /<<suggest target="([A-Za-z0-9:_-]{1,120})">>([\s\S]*?)<<\/suggest>>/;
const SUGGEST_START = '<<suggest';
const CHIP = /\[\[([^\]\n]{1,200})\]\]/g;
const LIST_ITEM = /^\s*(?:[-*]|\d+[.)])\s+/;

const withoutOpenMarkers = (text: string): string => {
  const suggestAt = text.indexOf(SUGGEST_START);
  const closed = suggestAt === -1 || SUGGEST.test(text.slice(suggestAt));
  const trimmed = closed ? text : text.slice(0, suggestAt);
  const lastOpen = trimmed.lastIndexOf('[[');
  if (lastOpen === -1 || trimmed.indexOf(']]', lastOpen) !== -1) {
    return trimmed;
  }
  return trimmed.slice(0, lastOpen);
};

type ResolveParams = {
  readonly raw: string;
  readonly byKey: ReadonlyMap<string, AskHandle>;
};

const resolveHandle = ({ raw, byKey }: ResolveParams): AskHandle | null =>
  byKey.get(raw.trim()) ?? decodeAskHandle({ text: raw }) ?? fileHandleOf({ text: raw });

type StabilizeParams = {
  readonly text: string;
  readonly handles: ReadonlyArray<AskHandle>;
};

export const stabilizeAskAnswer = ({ text, handles }: StabilizeParams): string => {
  const byKey = new Map(handles.map((handle) => [handle.key, handle]));
  return text
    .replace(CHIP, (whole, raw: string) => {
      const handle = byKey.get(raw.trim()) ?? fileHandleOf({ text: raw });
      return handle === null ? whole : encodeAskHandle(handle);
    })
    .replace(SUGGEST, (whole, key: string, words: string) => {
      const handle = byKey.get(key);
      if (handle === undefined) {
        return whole;
      }
      const ref = encodeAskHandle(handle).slice(2).split('|')[0] ?? key;
      return `<<suggest target="${ref}">>${words}<</suggest>>`;
    });
};

type InlineParams = {
  readonly line: string;
  readonly byKey: ReadonlyMap<string, AskHandle>;
  readonly cited: Map<string, AskHandle>;
};

const inlinesOf = ({ line, byKey, cited }: InlineParams): ReadonlyArray<AskInline> => {
  const inlines: Array<AskInline> = [];
  let isBold = false;
  const pushText = (text: string): void => {
    const parts = text.split('**');
    parts.forEach((part, index) => {
      if (index > 0) {
        isBold = !isBold;
      }
      if (part !== '') {
        inlines.push({ kind: 'text', text: part, isBold });
      }
    });
  };
  let cursor = 0;
  for (const match of line.matchAll(CHIP)) {
    const at = match.index;
    pushText(line.slice(cursor, at));
    const raw = match[1] ?? '';
    const handle = resolveHandle({ raw, byKey });
    if (handle === null) {
      pushText(raw);
    }
    if (handle !== null) {
      cited.set(handle.key, handle);
      inlines.push({ kind: 'chip', handle });
    }
    cursor = at + match[0].length;
  }
  pushText(line.slice(cursor));
  return inlines;
};

export const parseAskAnswer = ({ text, handles }: Params): ParsedAskAnswer => {
  const byKey = new Map(handles.map((handle) => [handle.key, handle]));
  const visible = withoutOpenMarkers(text);
  const suggestMatch = SUGGEST.exec(visible);
  const suggestTarget = suggestMatch?.[1] ?? '';
  const suggestHandle =
    suggestMatch === null
      ? null
      : (byKey.get(suggestTarget) ??
        decodeAskHandle({ text: `${suggestTarget}|${suggestTarget}` }));
  const suggestion: AskSuggestion | null =
    suggestHandle === null ||
    (suggestHandle.target.kind !== 'question' && suggestHandle.target.kind !== 'agent')
      ? null
      : { handle: suggestHandle, text: (suggestMatch?.[2] ?? '').trim() };
  const body = visible.replace(SUGGEST, '').trim();
  const cited = new Map<string, AskHandle>();
  const blocks: Array<AskBlock> = [];
  for (const line of body.split('\n')) {
    if (line.trim() === '') {
      continue;
    }
    const isItem = LIST_ITEM.test(line);
    const content = isItem ? line.replace(LIST_ITEM, '') : line.trim();
    blocks.push({
      kind: isItem ? 'item' : 'paragraph',
      inlines: inlinesOf({ line: content, byKey, cited }),
    });
  }
  return {
    blocks,
    cited: [...cited.values()],
    suggestion: suggestion !== null && suggestion.text === '' ? null : suggestion,
  };
};
