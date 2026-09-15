import type { WireframeAction, WireframeDocument, WireframeNode } from '@goodboy/core';

export type WireframeIndex = Readonly<{
  screenByNodeId: ReadonlyMap<string, string>;
  actionByNodeId: ReadonlyMap<string, WireframeAction>;
  hotspots: ReadonlySet<string>;
}>;

const walk = ({
  node,
  screenId,
  screenByNodeId,
  actionByNodeId,
}: {
  readonly node: WireframeNode;
  readonly screenId: string;
  readonly screenByNodeId: Map<string, string>;
  readonly actionByNodeId: Map<string, WireframeAction>;
}): void => {
  screenByNodeId.set(node.id, screenId);
  if (node.kind === 'stack' || node.kind === 'grid') {
    for (const child of node.children) {
      walk({ node: child, screenId, screenByNodeId, actionByNodeId });
    }
    return;
  }
  if (node.kind === 'button') {
    if (node.action !== undefined) {
      actionByNodeId.set(node.id, node.action);
    }
    return;
  }
  if (node.kind === 'list') {
    for (const item of node.items) {
      screenByNodeId.set(item.id, screenId);
      if (item.action !== undefined) {
        actionByNodeId.set(item.id, item.action);
      }
    }
    return;
  }
  if (node.kind === 'navigation') {
    for (const item of node.items) {
      screenByNodeId.set(item.id, screenId);
      if (item.action !== undefined) {
        actionByNodeId.set(item.id, item.action);
      }
    }
  }
};

export const buildWireframeIndex = ({
  document,
}: {
  readonly document: WireframeDocument;
}): WireframeIndex => {
  const screenByNodeId = new Map<string, string>();
  const actionByNodeId = new Map<string, WireframeAction>();
  for (const screen of document.screens) {
    walk({ node: screen.root, screenId: screen.id, screenByNodeId, actionByNodeId });
  }
  for (const transition of document.transitions) {
    actionByNodeId.set(transition.fromNodeId, {
      type: 'navigate',
      toScreenId: transition.toScreenId,
    });
  }
  return { screenByNodeId, actionByNodeId, hotspots: new Set(actionByNodeId.keys()) };
};
