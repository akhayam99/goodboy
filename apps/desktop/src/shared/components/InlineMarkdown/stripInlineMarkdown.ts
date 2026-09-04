import { parseInlineMarkdown, type InlineToken } from './parseInlineMarkdown';

type Params = {
  readonly text: string;
};

const flatten = (tokens: ReadonlyArray<InlineToken>): string =>
  tokens
    .map((token) => {
      if (token.kind === 'text' || token.kind === 'code') {
        return token.value;
      }
      return flatten(token.children);
    })
    .join('');

export const stripInlineMarkdown = ({ text }: Params): string =>
  flatten(parseInlineMarkdown({ text }));
