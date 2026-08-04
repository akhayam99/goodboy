type Params = {
  readonly text: string | null | undefined;
};

const HTML_COMMENT_RE = /<!--[\s\S]*?-->/g;
const FENCE_RE = /```[\s\S]*?```/g;
const INLINE_CODE_RE = /`([^`]*)`/g;
const HTML_TAG_RE = /<\/?[a-zA-Z][^>]*>/g;
const HEADING_RE = /^\s{0,3}#{1,6}\s+/gm;
const LIST_RE = /^\s*(?:[-*+]|\d+\.)\s+/gm;
const QUOTE_RE = /^\s*>\s?/gm;
const BOLD_RE = /\*\*([^*]+)\*\*|__([^_]+)__/g;
const ITALIC_RE = /(?<![*\w])\*([^*]+)\*(?!\*)|(?<![_\w])_([^_]+)_(?!_)/g;

export const markdownPreview = ({ text }: Params): string => {
  if (text == null) {
    return '';
  }
  return text
    .replace(HTML_COMMENT_RE, ' ')
    .replace(FENCE_RE, ' ')
    .replace(INLINE_CODE_RE, '$1')
    .replace(HTML_TAG_RE, ' ')
    .replace(HEADING_RE, '')
    .replace(LIST_RE, '')
    .replace(QUOTE_RE, '')
    .replace(BOLD_RE, (_match, a: string | undefined, b: string | undefined) => a ?? b ?? '')
    .replace(ITALIC_RE, (_match, a: string | undefined, b: string | undefined) => a ?? b ?? '')
    .replace(/\s+/g, ' ')
    .trim();
};
