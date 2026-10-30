import { parseMarkdown } from '@goodboy/ui';

type Blocks = ReturnType<typeof parseMarkdown>['blocks'];

type BlocksParams = {
  readonly blocks: Blocks;
};

const hasCodeOrTable = ({ blocks }: BlocksParams): boolean =>
  blocks.some((block) => {
    if (block.kind === 'code' || block.kind === 'table') {
      return true;
    }
    if (block.kind === 'list') {
      return block.items.some((item) => hasCodeOrTable({ blocks: item.children }));
    }
    if (block.kind === 'callout') {
      return hasCodeOrTable({ blocks: block.blocks });
    }
    if (block.kind === 'compare') {
      return hasCodeOrTable({ blocks: block.before }) || hasCodeOrTable({ blocks: block.after });
    }
    return false;
  });

type Params = {
  readonly text: string;
};

const hasFenceLine = ({ text }: Params): boolean =>
  text.split('\n').some((line) => line.trimStart().startsWith('```'));

export const hasUnclampableBlock = ({ text }: Params): boolean =>
  hasFenceLine({ text }) || hasCodeOrTable({ blocks: parseMarkdown({ text }).blocks });
