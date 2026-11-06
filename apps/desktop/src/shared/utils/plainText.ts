import { inlineMarkdownText } from '@goodboy/ui';

type Params = {
  readonly text: string;
};

const STRAY_MARKERS = /\*\*|(?<!\w)__|__(?!\w)|~~|`/g;

export const plainText = ({ text }: Params): string =>
  inlineMarkdownText({ text }).replace(STRAY_MARKERS, '').trim();
