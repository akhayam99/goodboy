import { inlineMarkdownText } from '@goodboy/ui';

const LIST_MARKER = /^\s*(?:[-*+]|\d+[.)])\s+/;

type Params = {
  readonly body: string;
};

export const plainStateOf = ({ body }: Params): string =>
  inlineMarkdownText({
    text: body
      .split('\n')
      .map((line) => line.replace(LIST_MARKER, ''))
      .join('\n'),
  });
