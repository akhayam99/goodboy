import { ctxTagLabel } from './ctxTagStyle';
import { parseInline, type InlineNode } from './parseInline';

type Params = {
  readonly text: string;
};

const nodeText = (node: InlineNode): string => {
  switch (node.kind) {
    case 'text':
    case 'code':
      return node.value;
    case 'chip':
      return ctxTagLabel({ tag: node.tag });
    case 'image':
      return node.alt;
    case 'strong':
    case 'em':
    case 'del':
    case 'link':
      return flattenNodes(node.children);
    default: {
      const exhaustive: never = node;
      return exhaustive;
    }
  }
};

const flattenNodes = (nodes: ReadonlyArray<InlineNode>): string => nodes.map(nodeText).join('');

export const inlineMarkdownText = ({ text }: Params): string => flattenNodes(parseInline({ text }));
