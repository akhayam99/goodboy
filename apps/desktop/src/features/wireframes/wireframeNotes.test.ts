// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { WireframeDocument } from '@goodboy/core';
import { screenLinks, screenNodeNotes } from './wireframeNotes';

const document = {
  version: 1,
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
          { id: 'approve', kind: 'button', label: 'Approve batch', note: 'The only primary.' },
          { id: 'exception-list', kind: 'table', columns: ['A'], rows: [], note: 'Sorted first.' },
          { id: 'plain', kind: 'text', text: 'Batch 4471' },
        ],
      },
    },
    {
      id: 'release',
      title: 'Release batch',
      viewport: 'desktop',
      root: { id: 'release-root', kind: 'text', text: 'Released' },
    },
  ],
  transitions: [{ fromNodeId: 'approve', toScreenId: 'release', label: 'Approve' }],
} satisfies WireframeDocument;

const firstScreen = () => {
  const [screen] = document.screens;
  if (screen === undefined) {
    throw new Error('the fixture has no screen');
  }
  return screen;
};

describe('wireframe notes', () => {
  it('numbers the node notes in reading order', () => {
    const screen = firstScreen();
    expect(screenNodeNotes({ screen })).toEqual([
      { number: 1, nodeId: 'approve', label: 'Approve batch', note: 'The only primary.' },
      { number: 2, nodeId: 'exception-list', label: 'Exception list', note: 'Sorted first.' },
    ]);
  });

  it('lists where a screen goes, with the number of the target', () => {
    const screen = firstScreen();
    expect(screenLinks({ document, screen })).toEqual([
      {
        nodeId: 'approve',
        label: 'Approve',
        toScreenId: 'release',
        toTitle: 'Release batch',
        toNumber: 2,
      },
    ]);
  });
});
