import { describe, expect, it } from 'vitest';
import { diffWireframeDocuments } from './diffWireframeDocuments';
import type { WireframeDocument } from './schema';

const before: WireframeDocument = {
  version: 2,
  initialScreenId: 'review',
  theme: { name: 'generic' },
  screens: [
    {
      id: 'review',
      title: 'Review batch',
      viewport: 'desktop',
      root: {
        id: 'root',
        kind: 'stack',
        direction: 'column',
        children: [
          { id: 'heading', kind: 'text', text: 'Review batch 4471' },
          { id: 'exceptions', kind: 'table', columns: ['Posting'], rows: [] },
          { id: 'only-exceptions', kind: 'toggle', label: 'Only exceptions' },
          { id: 'approve', kind: 'button', label: 'Approve batch' },
        ],
      },
    },
    {
      id: 'audit',
      title: 'Audit',
      viewport: 'desktop',
      root: { id: 'audit-root', kind: 'text', text: 'Audit' },
    },
  ],
  transitions: [],
};

const after: WireframeDocument = {
  ...before,
  screens: [
    {
      id: 'review',
      title: 'Review batch',
      viewport: 'desktop',
      states: { empty: { label: 'Empty', hide: [], show: [], text: {} } },
      root: {
        id: 'root',
        kind: 'stack',
        direction: 'column',
        children: [
          { id: 'heading', kind: 'text', text: 'Review batch 4471' },
          { id: 'exceptions', kind: 'table', columns: ['Posting', 'Owner'], rows: [] },
          { id: 'unassigned', kind: 'badge', label: 'Unassigned 1 of 3' },
          { id: 'approve-batch', kind: 'button', label: 'Approve batch' },
        ],
      },
    },
    {
      id: 'assign',
      title: 'Assign owner',
      viewport: 'desktop',
      root: { id: 'assign-root', kind: 'text', text: 'Assign' },
    },
  ],
};

describe('diffWireframeDocuments', () => {
  it('diffs by node id and names the fields that changed', () => {
    const diff = diffWireframeDocuments({ before, after });
    const byId = new Map(diff.nodes.map((node) => [node.nodeId, node]));
    expect(byId.get('exceptions')).toMatchObject({ change: 'changed', fields: ['columns'] });
    expect(byId.get('unassigned')).toMatchObject({ change: 'added' });
    expect(byId.get('only-exceptions')).toMatchObject({ change: 'removed' });
    expect(byId.has('heading')).toBe(false);
  });

  it('treats a node that kept its kind, text and place under a new id as changed', () => {
    const diff = diffWireframeDocuments({ before, after });
    const renamed = diff.nodes.find((node) => node.nodeId === 'approve-batch');
    expect(renamed).toMatchObject({ change: 'changed', previousNodeId: 'approve' });
    expect(diff.nodes.some((node) => node.nodeId === 'approve')).toBe(false);
  });

  it('marks screens added, removed, changed and same, and counts the summary', () => {
    const diff = diffWireframeDocuments({ before, after });
    expect(diff.screens.map((screen) => [screen.screenId, screen.change])).toEqual([
      ['review', 'changed'],
      ['assign', 'added'],
      ['audit', 'removed'],
    ]);
    expect(diff.summary).toEqual({
      screensAdded: 1,
      screensChanged: 1,
      screensRemoved: 1,
      added: 1,
      changed: 2,
      removed: 1,
      statesAdded: 1,
    });
    const same = diffWireframeDocuments({ before, after: before });
    expect(same.screens.map((screen) => screen.change)).toEqual(['same', 'same']);
  });
});
