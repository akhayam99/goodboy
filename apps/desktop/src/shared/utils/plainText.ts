import { inlineMarkdownText } from '@goodboy/ui';

type Params = {
  readonly text: string;
};

export const plainText = ({ text }: Params): string =>
  inlineMarkdownText({ text, shouldStripUnmatchedMarkers: true }).trim();
