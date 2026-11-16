type CodeSpanPart = {
  readonly kind: 'text' | 'code';
  readonly value: string;
};

const CODE_SPAN = /`([^`\n]+)`/g;

type Params = {
  readonly text: string;
};

export const codeSpansOf = ({ text }: Params): ReadonlyArray<CodeSpanPart> => {
  const parts: Array<CodeSpanPart> = [];
  let cursor = 0;
  for (const match of text.matchAll(CODE_SPAN)) {
    const start = match.index;
    if (start > cursor) {
      parts.push({ kind: 'text', value: text.slice(cursor, start) });
    }
    parts.push({ kind: 'code', value: match[1] ?? '' });
    cursor = start + match[0].length;
  }
  if (cursor < text.length) {
    parts.push({ kind: 'text', value: text.slice(cursor) });
  }
  return parts;
};
