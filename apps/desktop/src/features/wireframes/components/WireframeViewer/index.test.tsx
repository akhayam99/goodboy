// @vitest-environment happy-dom
// @vitest-environment-options {"settings":{"navigation":{"disableChildFrameNavigation":true}}}

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const { state, frame } = vi.hoisted(() => ({
  state: {
    transcripts: {} as Record<string, ReadonlyArray<Record<string, unknown>>>,
    spawnWireframeAgent: vi.fn(async () => 'agent-wireframe'),
  },
  frame: {
    staged: [] as Array<ReadonlyArray<Readonly<{ path: string; contents: string }>>>,
    released: [] as Array<string>,
  },
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [] as readonly never[],
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

vi.mock('../../frame/frameInvoke', () => ({
  stageFrame: vi.fn(
    async ({ files }: { readonly files: ReadonlyArray<{ path: string; contents: string }> }) => {
      frame.staged.push(files);
      return `stage-${frame.staged.length}`;
    },
  ),
  releaseFrame: vi.fn(async ({ stageId }: { readonly stageId: string }) => {
    frame.released.push(stageId);
    return true;
  }),
}));

import { WireframeViewer } from './index';

const SESSION_ID = JSON.parse(JSON.stringify('session-1'));

const document = {
  version: 1,
  initialScreenId: 'batches',
  theme: { name: 'generic' },
  screens: [
    {
      id: 'batches',
      title: 'Settlement batches',
      viewport: 'desktop',
      note: 'The operator lands here from a flagged batch.',
      root: {
        id: 'batches-root',
        kind: 'stack',
        direction: 'column',
        children: [
          { id: 'batches-title', kind: 'text', text: 'Batches', variant: 'title' },
          {
            id: 'review',
            kind: 'button',
            label: 'Review',
            variant: 'primary',
            note: 'Approve is the only primary.',
          },
        ],
      },
    },
    {
      id: 'review-batch',
      title: 'Review batch',
      viewport: 'mobile',
      root: {
        id: 'review-root',
        kind: 'stack',
        direction: 'column',
        children: [{ id: 'review-title', kind: 'text', text: 'Batch 4471' }],
      },
    },
  ],
  transitions: [{ fromNodeId: 'review', toScreenId: 'review-batch', label: 'review' }],
};

const artifact = {
  id: 'wireframe-1',
  sessionId: SESSION_ID,
  agentId: 'agent-wireframe',
  workflowRunId: null,
  kind: 'wireframe',
  schemaVersion: 1,
  title: 'Settlement review flow',
  sourceFormat: 'json',
  sourceText: JSON.stringify(document),
  metadata: { fidelity: 'low' },
  status: 'active',
  revision: 1,
  sourceTurnId: 'run-1',
  createdAt: '2026-09-15T10:00:00.000Z',
  updatedAt: '2026-09-15T10:00:00.000Z',
};

const renderViewer = (overrides: Record<string, unknown> = {}) =>
  render(
    <WireframeViewer
      sessionId={SESSION_ID}
      artifact={JSON.parse(JSON.stringify({ ...artifact, ...overrides }))}
    />,
  );

const openScreens = async () => {
  fireEvent.click(screen.getByRole('tab', { name: 'Screens' }));
  return waitFor(() => screen.getByTestId('wireframe-frame'));
};

const postFromFrame = ({ source, data }: { readonly source: unknown; readonly data: unknown }) =>
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data, source: source as Window }));
  });

beforeEach(() => {
  frame.staged = [];
  frame.released = [];
});
afterEach(cleanup);

describe('WireframeViewer', () => {
  it('stages the same pages the folder holds, never a script', async () => {
    renderViewer();
    await waitFor(() => expect(frame.staged).toHaveLength(1));
    const paths = (frame.staged[0] ?? []).map((file) => file.path).sort();
    expect(paths).toEqual([
      'index.html',
      'screens/batches.html',
      'screens/review-batch.html',
      'wireframe.css',
    ]);
    const pages = (frame.staged[0] ?? []).filter((file) => file.path.endsWith('.html'));
    for (const page of pages) {
      expect(page.contents).not.toContain('<script');
      expect(page.contents).not.toContain('style=');
    }
  });

  it('opens on the flow with lazy page previews in isolated frames', async () => {
    renderViewer();
    expect(screen.getByTestId('wireframe-viewer').getAttribute('data-view')).toBe('flow');
    const previews = await waitFor(() => screen.getAllByTestId('wireframe-grid-item'));
    expect(previews).toHaveLength(2);
    const iframe = previews[0]?.querySelector('iframe');
    expect(iframe?.getAttribute('sandbox')).toBe('allow-scripts');
    expect(iframe?.getAttribute('loading')).toBe('lazy');
    expect(iframe?.getAttribute('src')).toMatch(/\/stage-1\/screens\/batches\.html$/);
  });

  it('shows a screen in a sandboxed frame without same origin, with the rail and the notes', async () => {
    renderViewer();
    const iframe = await openScreens();
    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts');
    expect(iframe.getAttribute('sandbox')).not.toContain('allow-same-origin');
    expect(iframe.getAttribute('src')).toMatch(
      /^(gbframe:\/\/localhost|http:\/\/gbframe\.localhost)\/stage-1\/screens\/batches\.html$/,
    );
    expect(screen.getByTestId('wireframe-screen-rail').textContent).toContain('Review batch');
    const notes = screen.getByTestId('wireframe-notes');
    expect(notes.textContent).toContain('The operator lands here from a flagged batch.');
    expect(notes.textContent).toContain('Approve is the only primary.');
    expect(notes.textContent).toContain('Review batch');
  });

  it('follows a navigation inside the frame and ignores messages from other windows', async () => {
    renderViewer();
    const iframe = (await openScreens()) as HTMLIFrameElement;
    const rail = screen.getByTestId('wireframe-screen-rail');
    const current = () => rail.querySelector('[aria-current="page"]')?.textContent ?? '';
    expect(current()).toContain('Settlement batches');
    await postFromFrame({
      source: window,
      data: {
        channel: 'gbframe',
        type: 'navigated',
        path: 'screens/review-batch.html',
        height: 900,
      },
    });
    expect(current()).toContain('Settlement batches');
    await postFromFrame({
      source: iframe.contentWindow,
      data: { channel: 'gbframe', type: 'navigated', path: '../escape.html', height: 900 },
    });
    expect(current()).toContain('Settlement batches');
    await postFromFrame({
      source: iframe.contentWindow,
      data: {
        channel: 'gbframe',
        type: 'navigated',
        path: 'screens/review-batch.html',
        height: 900,
      },
    });
    expect(current()).toContain('Review batch');
    expect(screen.getByTestId('wireframe-stage').getAttribute('data-device')).toBe('mobile');
  });

  it('opens a screen from the rail by loading its page', async () => {
    renderViewer();
    await openScreens();
    fireEvent.click(
      within(screen.getByTestId('wireframe-screen-rail')).getByRole('button', {
        name: /Review batch/,
      }),
    );
    await waitFor(() =>
      expect(screen.getByTestId('wireframe-frame').getAttribute('src')).toMatch(
        /screens\/review-batch\.html$/,
      ),
    );
  });

  it('releases the stage when the viewer goes away', async () => {
    const view = renderViewer();
    await waitFor(() => expect(frame.staged).toHaveLength(1));
    await waitFor(() => screen.getAllByTestId('wireframe-grid-item'));
    view.unmount();
    await waitFor(() => expect(frame.released).toEqual(['stage-1']));
  });

  it('shows the issues and a repair action when the spec is invalid', () => {
    renderViewer({ sourceText: '{"version":1}' });
    expect(screen.queryByTestId('wireframe-frame')).toBeNull();
    expect(frame.staged).toHaveLength(0);
    expect(screen.getByTestId('wireframe-repair')).toBeDefined();
  });
});
