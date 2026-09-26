import {
  walkWireframeNodes,
  type WireframeDiff,
  type WireframeDocument,
  type WireframeNode,
  type WireframeNodeChange,
} from '@goodboy/core';
import { wireframeNodeLabel } from './wireframeNodeLabel';
import type { WireframeDiffMark, WireframeDiffMarks } from './wireframePages/renderWireframeNode';

export type WireframeCompareMarks = Readonly<{
  before: ReadonlyMap<string, WireframeDiffMarks>;
  after: ReadonlyMap<string, WireframeDiffMarks>;
}>;

const put = ({
  into,
  screenId,
  nodeId,
  mark,
}: {
  readonly into: Map<string, Map<string, WireframeDiffMark>>;
  readonly screenId: string;
  readonly nodeId: string;
  readonly mark: WireframeDiffMark;
}): void => {
  const screen = into.get(screenId) ?? new Map<string, WireframeDiffMark>();
  screen.set(nodeId, mark);
  into.set(screenId, screen);
};

export const wireframeCompareMarks = ({
  diff,
}: {
  readonly diff: WireframeDiff;
}): WireframeCompareMarks => {
  const before = new Map<string, Map<string, WireframeDiffMark>>();
  const after = new Map<string, Map<string, WireframeDiffMark>>();
  for (const node of diff.nodes) {
    if (node.change === 'removed') {
      put({ into: before, screenId: node.screenId, nodeId: node.nodeId, mark: 'removed' });
      continue;
    }
    put({ into: after, screenId: node.screenId, nodeId: node.nodeId, mark: node.change });
  }
  return { before, after };
};

const findNode = ({
  document,
  nodeId,
}: {
  readonly document: WireframeDocument;
  readonly nodeId: string;
}): WireframeNode | null => {
  let found: WireframeNode | null = null;
  for (const screen of document.screens) {
    walkWireframeNodes({
      node: screen.root,
      visit: (node) => {
        if (node.id === nodeId) {
          found = node;
        }
      },
    });
  }
  return found;
};

const FIELD_WORDS: Readonly<Record<string, string>> = {
  text: 'text',
  label: 'label',
  title: 'title',
  columns: 'columns',
  rows: 'rows',
  items: 'items',
  variant: 'style',
  action: 'action',
  note: 'note',
  only: 'release cut',
  hidden: 'visibility',
  screen: 'screen',
  id: 'id',
};

const fieldsSentence = ({ fields }: { readonly fields: ReadonlyArray<string> }): string => {
  const words = [...new Set(fields.map((field) => FIELD_WORDS[field] ?? 'layout'))];
  if (words.length === 0) {
    return 'changed';
  }
  const head = words.slice(0, -1);
  const last = words[words.length - 1];
  return `${head.length === 0 ? last : `${head.join(', ')} and ${last}`} changed`;
};

export const describeWireframeChange = ({
  change,
  before,
  after,
}: {
  readonly change: WireframeNodeChange;
  readonly before: WireframeDocument;
  readonly after: WireframeDocument;
}): string => {
  const node =
    change.change === 'removed'
      ? findNode({ document: before, nodeId: change.nodeId })
      : findNode({ document: after, nodeId: change.nodeId });
  const label = node === null ? change.nodeId : wireframeNodeLabel({ node });
  if (change.change === 'added') {
    return `${label}: added`;
  }
  if (change.change === 'removed') {
    return `${label}: removed`;
  }
  return `${label}: ${fieldsSentence({ fields: change.fields })}`;
};

export const diffChangeCount = ({ diff }: { readonly diff: WireframeDiff }): number =>
  diff.summary.added +
  diff.summary.changed +
  diff.summary.removed +
  diff.summary.screensAdded +
  diff.summary.screensRemoved;
