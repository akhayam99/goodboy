// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { WireframeArtifact } from '@goodboy/types';
import { buildWireframeMirror } from './buildWireframeMirror';

const spec = {
  version: 2,
  initialScreenId: 'review-batch',
  theme: { name: 'generic' },
  variants: ['full', 'first-release'],
  screens: [
    {
      id: 'review-batch',
      title: 'Review batch',
      note: 'Approve stays locked while an exception is open.',
      states: {
        empty: { hide: ['exception-list'], show: ['all-clear'] },
        error: { text: { heading: 'The batch could not load' } },
      },
      root: {
        id: 'root',
        kind: 'stack',
        direction: 'column',
        children: [
          { id: 'heading', kind: 'text', text: 'Review batch 4471', variant: 'title' },
          {
            id: 'exception-list',
            kind: 'card',
            title: 'Exceptions',
            note: 'Exceptions sort first.',
            children: [{ id: 'row', kind: 'badge', label: 'Allocation 1 of 3' }],
          },
          { id: 'all-clear', kind: 'text', text: 'No exceptions', hidden: true },
          { id: 'bulk', kind: 'button', label: 'Approve all', only: ['full'] },
          {
            id: 'show-empty',
            kind: 'button',
            label: 'Show empty',
            action: { type: 'toggle', stateKey: 'empty' },
          },
        ],
      },
    },
  ],
  transitions: [],
};

const artifact = {
  id: 'artifact-8d21e0',
  kind: 'wireframe',
  title: 'Settlement review flow',
  sourceText: JSON.stringify(spec),
  metadata: { fidelity: 'low', designProfile: {} },
  revision: 3,
  createdAt: '2026-09-25T10:00:00.000Z',
  updatedAt: '2026-09-25T12:00:00.000Z',
} as unknown as WireframeArtifact;

const files = buildWireframeMirror({
  artifact,
  workspaceName: 'harborline',
  versions: [
    {
      revision: 3,
      title: 'Settlement review flow',
      sourceText: JSON.stringify(spec),
      author: 'agent',
      ask: 'Add empty and error states to Review batch',
      createdAt: '2026-09-25T12:00:00.000Z',
      summary: null,
    },
    {
      revision: 1,
      title: 'Settlement review flow',
      sourceText: JSON.stringify({ ...spec, variants: undefined }),
      author: 'agent',
      ask: null,
      createdAt: '2026-09-25T10:00:00.000Z',
      summary: null,
    },
  ],
});

const fileOf = (path: string): string => {
  const found = files.find((file) => file.path === path);
  if (found === undefined) {
    throw new Error(`missing ${path}`);
  }
  return found.contents;
};

describe('buildWireframeMirror', () => {
  it('writes a folder per version and an index of versions, newest first', () => {
    const paths = files.map((file) => file.path);
    expect(paths).toContain('v3/index.html');
    expect(paths).toContain('v3/screens/review-batch.html');
    expect(paths).toContain('v3/screens/review-batch--empty.html');
    expect(paths).toContain('v3/screens/review-batch--error.html');
    expect(paths).toContain('v1/wireframe.json');
    const index = fileOf('index.html');
    expect(index.indexOf('v3 Add empty and error states')).toBeLessThan(
      index.indexOf('v1 First draft'),
    );
    expect(JSON.parse(fileOf('v3/wireframe.json')).$schema).toBe('../wireframe.schema.json');
  });

  it('applies each state to its own page', () => {
    const page = fileOf('v3/screens/review-batch.html');
    const empty = fileOf('v3/screens/review-batch--empty.html');
    const error = fileOf('v3/screens/review-batch--error.html');
    expect(page).toContain('data-node="exception-list"');
    expect(page).not.toContain('data-node="all-clear"');
    expect(empty).not.toContain('data-node="exception-list"');
    expect(empty).toContain('data-node="all-clear"');
    expect(error).toContain('The batch could not load');
    expect(page).toContain('href="review-batch--empty.html"');
  });

  it('numbers the notes on the page and lists them beside the frame', () => {
    const page = fileOf('v3/screens/review-batch.html');
    expect(page).toContain('data-node="exception-list" data-kind="card" data-note="1"');
    expect(page).toContain('<details class="wf-notes wf-page-chrome" open>');
    expect(page).toContain('<li value="1"><a href="#exception-list">Exceptions</a>');
  });

  it('keeps a variant cut as classes the stylesheet hides', () => {
    expect(fileOf('v3/screens/review-batch.html')).toContain('wf-only wf-only-full');
    expect(fileOf('v3/wireframe.css')).toContain(
      "html[data-variant='first-release'] .wf-only:not(.wf-only-first-release) { display: none; }",
    );
  });

  it('ships pages with a CSP and no script or inline style', () => {
    for (const file of files.filter((entry) => entry.path.endsWith('.html'))) {
      expect(file.contents).toContain('http-equiv="Content-Security-Policy"');
      expect(file.contents).not.toMatch(/<script/i);
      expect(file.contents).not.toMatch(/\sstyle=/i);
    }
  });
});
