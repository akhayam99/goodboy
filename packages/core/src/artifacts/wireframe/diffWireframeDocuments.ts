import type { WireframeDocument, WireframeNode, WireframeScreen } from './schema';
import { wireframeNodeChildren } from './wireframeNodeChildren';

export type WireframeNodeChangeKind = 'added' | 'removed' | 'changed';

export type WireframeNodeChange = Readonly<{
  change: WireframeNodeChangeKind;
  screenId: string;
  nodeId: string;
  previousNodeId: string | null;
  kind: WireframeNode['kind'];
  fields: ReadonlyArray<string>;
}>;

export type WireframeScreenChangeKind = 'added' | 'removed' | 'changed' | 'same';

export type WireframeScreenChange = Readonly<{
  screenId: string;
  title: string;
  change: WireframeScreenChangeKind;
  statesAdded: number;
}>;

export type WireframeDiffSummary = Readonly<{
  screensAdded: number;
  screensChanged: number;
  screensRemoved: number;
  added: number;
  changed: number;
  removed: number;
  statesAdded: number;
}>;

export type WireframeDiff = Readonly<{
  screens: ReadonlyArray<WireframeScreenChange>;
  nodes: ReadonlyArray<WireframeNodeChange>;
  summary: WireframeDiffSummary;
}>;

type Entry = Readonly<{
  node: WireframeNode;
  screenId: string;
  position: number;
  own: Readonly<Record<string, string>>;
  text: string;
}>;

const OWN_SKIP = new Set(['id', 'children']);

const ownFields = ({ node }: { readonly node: WireframeNode }): Readonly<Record<string, string>> =>
  Object.fromEntries(
    Object.entries(node)
      .filter(([key]) => !OWN_SKIP.has(key))
      .map(([key, value]) => [key, JSON.stringify(value)]),
  );

const textOf = ({ node }: { readonly node: WireframeNode }): string => {
  switch (node.kind) {
    case 'text':
      return node.text;
    case 'button':
    case 'badge':
    case 'toggle':
    case 'chart':
      return node.label;
    case 'image':
      return node.alt;
    case 'card':
    case 'sheet':
      return node.title ?? '';
    case 'input':
      return node.label ?? node.placeholder ?? '';
    case 'stack':
    case 'grid':
    case 'list':
    case 'table':
    case 'navigation':
    case 'tabs':
      return '';
    default: {
      const exhaustive: never = node;
      return exhaustive;
    }
  }
};

const entriesOf = ({
  document,
}: {
  readonly document: WireframeDocument;
}): ReadonlyMap<string, Entry> => {
  const entries = new Map<string, Entry>();
  for (const screen of document.screens) {
    let position = 0;
    const visit = ({ node }: { readonly node: WireframeNode }): void => {
      entries.set(node.id, {
        node,
        screenId: screen.id,
        position,
        own: ownFields({ node }),
        text: textOf({ node }),
      });
      position += 1;
      for (const child of wireframeNodeChildren({ node })) {
        visit({ node: child });
      }
    };
    visit({ node: screen.root });
  }
  return entries;
};

const changedFields = ({
  before,
  after,
}: {
  readonly before: Entry;
  readonly after: Entry;
}): ReadonlyArray<string> => {
  const keys = new Set([...Object.keys(before.own), ...Object.keys(after.own)]);
  const fields = [...keys].filter((key) => before.own[key] !== after.own[key]).sort();
  return before.screenId === after.screenId ? fields : [...fields, 'screen'];
};

const isSameSlot = ({ before, after }: { readonly before: Entry; readonly after: Entry }) =>
  before.node.kind === after.node.kind &&
  before.screenId === after.screenId &&
  before.position === after.position &&
  before.text === after.text;

const screenSignature = ({ screen }: { readonly screen: WireframeScreen }): string =>
  JSON.stringify({
    title: screen.title,
    viewport: screen.viewport,
    note: screen.note ?? null,
    states: screen.states ?? null,
  });

export const diffWireframeDocuments = ({
  before,
  after,
}: {
  readonly before: WireframeDocument;
  readonly after: WireframeDocument;
}): WireframeDiff => {
  const was = entriesOf({ document: before });
  const now = entriesOf({ document: after });
  const removedIds = [...was.keys()].filter((id) => !now.has(id));
  const addedIds = [...now.keys()].filter((id) => !was.has(id));
  const renamed = new Map<string, string>();
  for (const addedId of addedIds) {
    const added = now.get(addedId);
    const match = removedIds.find((removedId) => {
      const removed = was.get(removedId);
      return (
        added !== undefined &&
        removed !== undefined &&
        ![...renamed.values()].includes(removedId) &&
        isSameSlot({ before: removed, after: added })
      );
    });
    if (match !== undefined) {
      renamed.set(addedId, match);
    }
  }
  const renamedFrom = new Set(renamed.values());
  const nodes: WireframeNodeChange[] = [];
  for (const [id, entry] of now) {
    const previousId = was.has(id) ? id : (renamed.get(id) ?? null);
    const previous = previousId === null ? undefined : was.get(previousId);
    if (previous === undefined) {
      nodes.push({
        change: 'added',
        screenId: entry.screenId,
        nodeId: id,
        previousNodeId: null,
        kind: entry.node.kind,
        fields: [],
      });
      continue;
    }
    const fields = changedFields({ before: previous, after: entry });
    if (fields.length === 0 && previousId === id) {
      continue;
    }
    nodes.push({
      change: 'changed',
      screenId: entry.screenId,
      nodeId: id,
      previousNodeId: previousId,
      kind: entry.node.kind,
      fields: previousId === id ? fields : [...fields, 'id'],
    });
  }
  for (const id of removedIds) {
    const entry = was.get(id);
    if (entry === undefined || renamedFrom.has(id)) {
      continue;
    }
    nodes.push({
      change: 'removed',
      screenId: entry.screenId,
      nodeId: id,
      previousNodeId: id,
      kind: entry.node.kind,
      fields: [],
    });
  }
  const touched = new Set(nodes.map((node) => node.screenId));
  const beforeScreens = new Map(before.screens.map((screen) => [screen.id, screen]));
  const afterIds = new Set(after.screens.map((screen) => screen.id));
  const screens: WireframeScreenChange[] = [
    ...after.screens.map((screen): WireframeScreenChange => {
      const previous = beforeScreens.get(screen.id);
      const statesAdded = Object.keys(screen.states ?? {}).filter(
        (state) => previous?.states?.[state] === undefined,
      ).length;
      if (previous === undefined) {
        return { screenId: screen.id, title: screen.title, change: 'added', statesAdded };
      }
      const isChanged =
        touched.has(screen.id) ||
        screenSignature({ screen }) !== screenSignature({ screen: previous });
      return {
        screenId: screen.id,
        title: screen.title,
        change: isChanged ? 'changed' : 'same',
        statesAdded,
      };
    }),
    ...before.screens
      .filter((screen) => !afterIds.has(screen.id))
      .map((screen): WireframeScreenChange => ({
        screenId: screen.id,
        title: screen.title,
        change: 'removed',
        statesAdded: 0,
      })),
  ];
  const count = ({ change }: { readonly change: WireframeNodeChangeKind }): number =>
    nodes.filter((node) => node.change === change && !isWholeScreen({ node, screens })).length;
  return {
    screens,
    nodes,
    summary: {
      screensAdded: screens.filter((screen) => screen.change === 'added').length,
      screensChanged: screens.filter((screen) => screen.change === 'changed').length,
      screensRemoved: screens.filter((screen) => screen.change === 'removed').length,
      added: count({ change: 'added' }),
      changed: count({ change: 'changed' }),
      removed: count({ change: 'removed' }),
      statesAdded: screens.reduce((total, screen) => total + screen.statesAdded, 0),
    },
  };
};

const isWholeScreen = ({
  node,
  screens,
}: {
  readonly node: WireframeNodeChange;
  readonly screens: ReadonlyArray<WireframeScreenChange>;
}): boolean =>
  screens.some(
    (screen) =>
      screen.screenId === node.screenId &&
      ((screen.change === 'added' && node.change === 'added') ||
        (screen.change === 'removed' && node.change === 'removed')),
  );
