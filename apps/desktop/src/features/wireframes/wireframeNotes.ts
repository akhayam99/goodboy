import {
  walkWireframeNodes,
  wireframeNodeItemIds,
  type WireframeDocument,
  type WireframeNode,
  type WireframeScreen,
} from '@goodboy/core';
import { wireframeNodeLabel } from './wireframeNodeLabel';

export type WireframeNodeNote = Readonly<{
  number: number;
  nodeId: string;
  label: string;
  note: string;
}>;

export type WireframeScreenLink = Readonly<{
  nodeId: string;
  label: string;
  toScreenId: string;
  toTitle: string;
  toNumber: number;
}>;

export const screenNodes = ({
  screen,
}: {
  readonly screen: WireframeScreen;
}): ReadonlyArray<WireframeNode> => {
  const nodes: Array<WireframeNode> = [];
  walkWireframeNodes({ node: screen.root, visit: (node) => nodes.push(node) });
  return nodes;
};

export const screenNodeNotes = ({
  screen,
}: {
  readonly screen: WireframeScreen;
}): ReadonlyArray<WireframeNodeNote> =>
  screenNodes({ screen })
    .flatMap((node) =>
      node.note === undefined || node.note.trim().length === 0
        ? []
        : [{ nodeId: node.id, label: wireframeNodeLabel({ node }), note: node.note }],
    )
    .map((entry, index) => ({ ...entry, number: index + 1 }));

export const screenLinks = ({
  document,
  screen,
}: {
  readonly document: WireframeDocument;
  readonly screen: WireframeScreen;
}): ReadonlyArray<WireframeScreenLink> => {
  const nodes = screenNodes({ screen });
  const labels = new Map<string, string>();
  for (const node of nodes) {
    labels.set(node.id, wireframeNodeLabel({ node }));
    for (const id of wireframeNodeItemIds({ node })) {
      labels.set(id, id);
    }
  }
  return document.transitions.flatMap((transition) => {
    const label = labels.get(transition.fromNodeId);
    const toNumber = document.screens.findIndex((entry) => entry.id === transition.toScreenId);
    const target = document.screens[toNumber];
    if (label === undefined || target === undefined) {
      return [];
    }
    return [
      {
        nodeId: transition.fromNodeId,
        label: transition.label.length > 0 ? transition.label : label,
        toScreenId: target.id,
        toTitle: target.title,
        toNumber: toNumber + 1,
      },
    ];
  });
};
