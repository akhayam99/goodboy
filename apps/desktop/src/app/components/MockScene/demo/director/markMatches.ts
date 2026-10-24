import type { MarkedSegment } from '@goodboy/types';

type Params = {
  readonly text: string;
  readonly tokens: ReadonlyArray<string>;
};

const escapeToken = (token: string): string => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const markMatches = ({ text, tokens }: Params): ReadonlyArray<MarkedSegment> => {
  if (tokens.length === 0) {
    return text.length === 0 ? [] : [{ text, isMatch: false }];
  }
  const pattern = new RegExp(`(${tokens.map((token) => escapeToken(token)).join('|')})`, 'giu');
  const segments: MarkedSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const at = match.index;
    if (at > last) {
      segments.push({ text: text.slice(last, at), isMatch: false });
    }
    segments.push({ text: match[0], isMatch: true });
    last = at + match[0].length;
  }
  if (last < text.length) {
    segments.push({ text: text.slice(last), isMatch: false });
  }
  return segments;
};
