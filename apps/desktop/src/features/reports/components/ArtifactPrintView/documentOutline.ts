import { parseMarkdown } from '@goodboy/ui';

type Params = {
  readonly sourceText: string;
};

export const CONTENTS_MIN_SECTIONS = 3;

export const documentOutline = ({ sourceText }: Params): ReadonlyArray<string> =>
  parseMarkdown({ text: sourceText })
    .blocks.filter((block) => block.kind === 'heading' && block.level === 2)
    .map((block) => (block.kind === 'heading' ? block.content : ''))
    .filter((title) => title.length > 0);
