const PREAMBLE_PATTERN =
  /^\s*(?:(?:the\s+)?(?:run\s+|workflow\s+)?(?:title|titolo)|name|nome)\s*[:\-]\s*/i;

const MARKDOWN_EDGE_PATTERN = /^(?:\s|#{1,6}\s|[>*-]\s|\*\*|__|`|~~)+|(?:\s|\*\*|__|`|~~)+$/g;

const WRAPPING_QUOTES_PATTERN = /^["'`“”‘’]+|["'`“”‘’]+$/g;

type Params = {
  readonly text: string;
};

export const stripTitlePreamble = ({ text }: Params): string => {
  const flattened = text
    .replace(MARKDOWN_EDGE_PATTERN, '')
    .replace(WRAPPING_QUOTES_PATTERN, '')
    .trim();
  const stripped = flattened.replace(PREAMBLE_PATTERN, '');
  return stripped === flattened
    ? flattened
    : stripped.replace(MARKDOWN_EDGE_PATTERN, '').replace(WRAPPING_QUOTES_PATTERN, '').trim();
};
