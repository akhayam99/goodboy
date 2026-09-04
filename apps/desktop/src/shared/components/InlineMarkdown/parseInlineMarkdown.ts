export type InlineToken =
  | { readonly kind: 'text'; readonly value: string }
  | { readonly kind: 'code'; readonly value: string }
  | { readonly kind: 'strong'; readonly children: ReadonlyArray<InlineToken> }
  | { readonly kind: 'em'; readonly children: ReadonlyArray<InlineToken> };

type Params = {
  readonly text: string;
};

const EM_BOUNDARY_RE = /[\s(\[{,.!?:;'"]/;

const isEmphasisStart = ({ text, index }: { readonly text: string; readonly index: number }) => {
  const previous = text[index - 1];
  if (previous === undefined) {
    return true;
  }
  return EM_BOUNDARY_RE.test(previous);
};

export const parseInlineMarkdown = ({ text }: Params): ReadonlyArray<InlineToken> => {
  const tokens: InlineToken[] = [];
  let buffer = '';
  let index = 0;

  const flush = () => {
    if (buffer.length === 0) {
      return;
    }
    tokens.push({ kind: 'text', value: buffer });
    buffer = '';
  };

  while (index < text.length) {
    const char = text[index]!;

    if (char === '`') {
      const end = text.indexOf('`', index + 1);
      if (end > index + 1) {
        flush();
        tokens.push({ kind: 'code', value: text.slice(index + 1, end) });
        index = end + 1;
        continue;
      }
    }

    if ((char === '*' || char === '_') && text[index + 1] === char) {
      const delimiter = `${char}${char}`;
      const end = text.indexOf(delimiter, index + 2);
      if (end > index + 2) {
        flush();
        tokens.push({
          kind: 'strong',
          children: parseInlineMarkdown({ text: text.slice(index + 2, end) }),
        });
        index = end + 2;
        continue;
      }
    }

    if ((char === '*' || char === '_') && text[index + 1] !== char) {
      if (isEmphasisStart({ text, index })) {
        const end = text.indexOf(char, index + 1);
        if (end > index + 1 && text[end + 1] !== char) {
          flush();
          tokens.push({
            kind: 'em',
            children: parseInlineMarkdown({ text: text.slice(index + 1, end) }),
          });
          index = end + 1;
          continue;
        }
      }
    }

    buffer += char;
    index++;
  }

  flush();
  return tokens;
};
