export type InlineNode =
  | { readonly kind: 'text'; readonly value: string }
  | { readonly kind: 'code'; readonly value: string }
  | { readonly kind: 'chip'; readonly tag: string; readonly label: string | null }
  | { readonly kind: 'strong'; readonly children: ReadonlyArray<InlineNode> }
  | { readonly kind: 'em'; readonly children: ReadonlyArray<InlineNode> }
  | { readonly kind: 'del'; readonly children: ReadonlyArray<InlineNode> }
  | { readonly kind: 'link'; readonly url: string; readonly children: ReadonlyArray<InlineNode> }
  | { readonly kind: 'image'; readonly alt: string; readonly url: string };

type Params = {
  readonly text: string;
};

const CTX_TAG_RE = /^([a-zA-Z][a-zA-Z0-9_-]*)(?::[^\S\n]*([^<>\n]{1,48}?))?[^\S\n]*$/;
const CTX_CODE_RE = /^<<([a-zA-Z][a-zA-Z0-9_-]*)>>$/;
const EM_BOUNDARY_RE = /\s|[(\[{,.!?]/;
const SAFE_LINK_RE = /^(https?:|mailto:)/i;

export const parseInline = ({ text }: Params): ReadonlyArray<InlineNode> => {
  const out: InlineNode[] = [];
  let buf = '';
  let i = 0;
  const flush = () => {
    if (buf.length > 0) {
      out.push({ kind: 'text', value: buf });
      buf = '';
    }
  };

  while (i < text.length) {
    const ch = text[i];

    if (ch === '<' && text[i + 1] === '<') {
      const close = text.indexOf('>>', i + 2);
      if (close > i) {
        const inner = text.slice(i + 2, close);
        const chip = inner.match(CTX_TAG_RE);
        if (chip !== null) {
          flush();
          out.push({ kind: 'chip', tag: chip[1] ?? inner, label: chip[2] ?? null });
          i = close + 2;
          continue;
        }
      }
    }

    if (ch === '`') {
      const end = text.indexOf('`', i + 1);
      if (end > i) {
        const inner = text.slice(i + 1, end);
        const ctxMatch = inner.match(CTX_CODE_RE);
        flush();
        if (ctxMatch) {
          out.push({ kind: 'chip', tag: ctxMatch[1]!, label: null });
          i = end + 1;
          continue;
        }
        out.push({ kind: 'code', value: inner });
        i = end + 1;
        continue;
      }
    }

    if ((ch === '*' || ch === '_') && text[i + 1] === ch) {
      const delim = ch + ch;
      const end = text.indexOf(delim, i + 2);
      if (end > i) {
        flush();
        out.push({ kind: 'strong', children: parseInline({ text: text.slice(i + 2, end) }) });
        i = end + 2;
        continue;
      }
    }

    if (ch === '~' && text[i + 1] === '~') {
      const end = text.indexOf('~~', i + 2);
      if (end > i) {
        flush();
        out.push({ kind: 'del', children: parseInline({ text: text.slice(i + 2, end) }) });
        i = end + 2;
        continue;
      }
    }

    if ((ch === '*' || ch === '_') && text[i + 1] !== ch) {
      const prev = text[i - 1];
      const isWordBoundary = !prev || EM_BOUNDARY_RE.test(prev);
      if (isWordBoundary) {
        const end = text.indexOf(ch, i + 1);
        if (end > i && text[end - 1] !== ch) {
          flush();
          out.push({ kind: 'em', children: parseInline({ text: text.slice(i + 1, end) }) });
          i = end + 1;
          continue;
        }
      }
    }

    if (ch === '!' && text[i + 1] === '[') {
      const closeBracket = text.indexOf(']', i + 2);
      if (closeBracket > i && text[closeBracket + 1] === '(') {
        const closeParen = text.indexOf(')', closeBracket + 2);
        if (closeParen > closeBracket) {
          flush();
          out.push({
            kind: 'image',
            alt: text.slice(i + 2, closeBracket),
            url: text.slice(closeBracket + 2, closeParen).trim(),
          });
          i = closeParen + 1;
          continue;
        }
      }
    }

    if (ch === '[') {
      const closeBracket = text.indexOf(']', i + 1);
      if (closeBracket > i && text[closeBracket + 1] === '(') {
        const closeParen = text.indexOf(')', closeBracket + 2);
        if (closeParen > closeBracket) {
          const label = text.slice(i + 1, closeBracket);
          const url = text.slice(closeBracket + 2, closeParen);
          flush();
          if (SAFE_LINK_RE.test(url)) {
            out.push({ kind: 'link', url, children: parseInline({ text: label }) });
          } else {
            out.push({ kind: 'text', value: label });
          }
          i = closeParen + 1;
          continue;
        }
      }
    }

    buf += ch;
    i++;
  }

  flush();
  return out;
};
