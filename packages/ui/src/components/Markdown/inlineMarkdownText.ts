import { ctxTagLabel } from './ctxTagStyle';
import { parseInline, type InlineNode } from './parseInline';

type Params = {
  readonly text: string;
  readonly shouldStripUnmatchedMarkers?: boolean;
};

type NodeTextParams = {
  readonly node: InlineNode;
  readonly shouldStripUnmatchedMarkers: boolean;
};

type FlattenNodesParams = {
  readonly nodes: ReadonlyArray<InlineNode>;
  readonly shouldStripUnmatchedMarkers: boolean;
};

const STRAY_MARKERS = /\*\*|(?<!\w)__|__(?!\w)|~~|`/g;

const nodeText = ({ node, shouldStripUnmatchedMarkers }: NodeTextParams): string => {
  switch (node.kind) {
    case 'text':
      return shouldStripUnmatchedMarkers ? node.value.replace(STRAY_MARKERS, '') : node.value;
    case 'code':
      return node.value;
    case 'chip':
      return node.label ?? ctxTagLabel({ tag: node.tag });
    case 'image':
      return node.alt;
    case 'video':
      return 'video';
    case 'strong':
    case 'em':
    case 'del':
    case 'link':
      return flattenNodes({ nodes: node.children, shouldStripUnmatchedMarkers });
    default: {
      const exhaustive: never = node;
      return exhaustive;
    }
  }
};

const flattenNodes = ({ nodes, shouldStripUnmatchedMarkers }: FlattenNodesParams): string =>
  nodes.map((node) => nodeText({ node, shouldStripUnmatchedMarkers })).join('');

export const inlineMarkdownText = ({ text, shouldStripUnmatchedMarkers = false }: Params): string =>
  flattenNodes({ nodes: parseInline({ text }), shouldStripUnmatchedMarkers });
