import type { WireframeNavigationItem, WireframeNode } from './schema';

export const wireframeNodeChildren = ({
  node,
}: {
  readonly node: WireframeNode;
}): ReadonlyArray<WireframeNode> => {
  if (
    node.kind === 'stack' ||
    node.kind === 'grid' ||
    node.kind === 'card' ||
    node.kind === 'sheet'
  ) {
    return node.children;
  }
  return [];
};

export const wireframeNodeItemIds = ({
  node,
}: {
  readonly node: WireframeNode;
}): ReadonlyArray<string> => {
  if (node.kind === 'list') {
    return node.items.map((item) => item.id);
  }
  if (node.kind === 'navigation' || node.kind === 'tabs') {
    return node.items.map((item: WireframeNavigationItem) => item.id);
  }
  return [];
};

export const walkWireframeNodes = ({
  node,
  visit,
}: {
  readonly node: WireframeNode;
  readonly visit: (node: WireframeNode) => void;
}): void => {
  visit(node);
  for (const child of wireframeNodeChildren({ node })) {
    walkWireframeNodes({ node: child, visit });
  }
};
