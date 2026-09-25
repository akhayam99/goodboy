import { describe, expect, it } from 'vitest';
import { parseWireframeSource, WIREFRAME_NODE_KINDS, type WireframeDocument } from '@goodboy/core';
import type { WireframeArtifact } from '@goodboy/types';
import { buildWireframeExport } from './buildWireframeExport';

const source = {
  version: 1,
  initialScreenId: 'settlement-batches',
  theme: { name: 'harborline', colors: { accent: '#1f6feb' } },
  screens: [
    {
      id: 'settlement-batches',
      title: 'Settlement batches',
      viewport: 'desktop',
      root: {
        id: 'batches-root',
        kind: 'stack',
        direction: 'column',
        children: [
          { id: 'batches-title', kind: 'text', text: 'Batches & "fees"', variant: 'title' },
          {
            id: 'batches-list',
            kind: 'list',
            items: [{ id: 'batch-1', title: 'Northwind 0925' }],
          },
          {
            id: 'open-review',
            kind: 'button',
            label: 'Review',
            variant: 'primary',
            action: { type: 'navigate', toScreenId: 'review-batch' },
          },
        ],
      },
    },
    {
      id: 'review-batch',
      title: 'Review batch',
      viewport: 'desktop',
      root: {
        id: 'review-root',
        kind: 'stack',
        direction: 'column',
        children: [{ id: 'back', kind: 'button', label: 'Back' }],
      },
    },
  ],
  transitions: [
    { fromNodeId: 'batch-1', toScreenId: 'review-batch', label: 'open a batch' },
    { fromNodeId: 'back', toScreenId: 'settlement-batches', label: 'go back' },
  ],
  mockState: { hasExceptions: true },
};

const parsed = parseWireframeSource({ source: JSON.stringify(source) });

const wireframeDocument = (): WireframeDocument => {
  if (parsed.status !== 'valid') {
    throw new Error('fixture must be valid');
  }
  return parsed.document;
};

const artifact = {
  id: 'artifact-8d21e0',
  sessionId: 'session-1',
  agentId: null,
  workflowRunId: null,
  kind: 'wireframe',
  schemaVersion: 1,
  title: 'Settlement review flow',
  sourceFormat: 'json',
  sourceText: JSON.stringify(source),
  metadata: { fidelity: 'high', designProfile: {} },
  status: 'active',
  revision: 2,
  sourceTurnId: null,
  createdAt: '2026-09-25T10:00:00.000Z',
  updatedAt: '2026-09-25T11:00:00.000Z',
} as unknown as WireframeArtifact;

const built = buildWireframeExport({
  artifact,
  document: wireframeDocument(),
  appVersion: '0.6.0',
});

const fileOf = (path: string): string => {
  const found = built.files.find((file) => file.path === path);
  if (found === undefined) {
    throw new Error(`missing ${path}`);
  }
  return found.contents;
};

describe('buildWireframeExport', () => {
  it('names the folder by date, title and the id suffix', () => {
    expect(built.folder).toBe('2026-09-25-settlement-review-flow-8d21e0');
  });

  it('writes the files the design names, one page per screen', () => {
    expect(built.files.map((file) => file.path)).toEqual([
      'index.html',
      'screens/settlement-batches.html',
      'screens/review-batch.html',
      'wireframe.css',
      'wireframe.json',
      'wireframe.schema.json',
      'README.md',
      'meta.json',
    ]);
  });

  it('links screens to each other with plain relative links', () => {
    const batches = fileOf('screens/settlement-batches.html');
    expect(batches).toContain('<a class="wf-button wf-button-primary" href="review-batch.html">');
    expect(batches).toContain('<a class="wf-list-item" href="review-batch.html">');
    expect(batches).toContain('href="../wireframe.css"');
    expect(batches).toContain('href="../index.html"');
    expect(fileOf('screens/review-batch.html')).toContain('href="settlement-batches.html"');
  });

  it('lists every screen and the flow on the index', () => {
    const index = fileOf('index.html');
    expect(index).toContain('href="screens/settlement-batches.html"');
    expect(index).toContain('href="screens/review-batch.html"');
    expect(index).toContain('open a batch');
    expect(index).toContain('href="wireframe.css"');
  });

  it('ships no script, no style element and no inline style', () => {
    for (const file of built.files.filter((entry) => entry.path.endsWith('.html'))) {
      expect(file.contents).not.toMatch(/<script/i);
      expect(file.contents).not.toMatch(/<style/i);
      expect(file.contents).not.toMatch(/\sstyle=/i);
    }
  });

  it('escapes the text of the document', () => {
    expect(fileOf('screens/settlement-batches.html')).toContain('Batches &amp; &quot;fees&quot;');
  });

  it('points the JSON at its schema and the schema at every node kind', () => {
    const json = JSON.parse(fileOf('wireframe.json')) as Record<string, unknown>;
    expect(json['$schema']).toBe('./wireframe.schema.json');
    const schema = fileOf('wireframe.schema.json');
    for (const kind of WIREFRAME_NODE_KINDS) {
      expect(schema).toContain(`"${kind}Node"`);
    }
  });

  it('takes the palette of a high fidelity wireframe into the stylesheet', () => {
    expect(fileOf('wireframe.css')).toContain('--wf-accent: #1f6feb;');
    expect(fileOf('wireframe.css')).toContain('.wf-button-primary {');
  });

  it('lists the mock state toggles in the readme and records the revision in meta', () => {
    expect(fileOf('README.md')).toContain('`hasExceptions`: on by default');
    expect(JSON.parse(fileOf('meta.json'))).toMatchObject({
      id: 'artifact-8d21e0',
      kind: 'wireframe',
      revision: 2,
      appVersion: '0.6.0',
    });
  });
});
