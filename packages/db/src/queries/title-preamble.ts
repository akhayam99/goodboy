import { stripMarkdownEdges } from './strip-markdown-edges';
import { stripWrappingQuotes } from './strip-wrapping-quotes';

const PREAMBLE_PATTERN =
  /^\s*(?:(?:the\s+)?(?:run\s+|workflow\s+)?(?:title|titolo)|name|nome)\s*[:\-]\s*/i;

type Params = {
  readonly text: string;
};

const flattenedOf = ({ text }: Params): string =>
  stripWrappingQuotes({ text: stripMarkdownEdges({ text }) }).trim();

export const stripTitlePreamble = ({ text }: Params): string => {
  const flattened = flattenedOf({ text });
  const stripped = flattened.replace(PREAMBLE_PATTERN, '');
  return stripped === flattened ? flattened : flattenedOf({ text: stripped });
};
