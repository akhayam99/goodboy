import type { ComponentType } from 'react';
import { MarkdownBlocksScene } from './MarkdownBlocksScene';

export const U31_MARKDOWN_BLOCKS_SCENES = {
  'u31-markdown-blocks': () => <MarkdownBlocksScene />,
} satisfies Readonly<Record<string, ComponentType>>;
