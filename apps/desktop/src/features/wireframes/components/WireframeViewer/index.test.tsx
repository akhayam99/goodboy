// @vitest-environment happy-dom
// @vitest-environment-options {"settings":{"navigation":{"disableChildFrameNavigation":true}}}

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const { state, frame, revisions } = vi.hoisted(() => ({
  revisions: { rows: [] as Array<Record<string, unknown>> },
  state: {
    transcripts: {} as Record<string, ReadonlyArray<Record<string, unknown>>>,
    spawnWireframeAgent: vi.fn(async () => 'agent-wireframe'),
    wireframeDrafts: {} as Record<string, Record<string, unknown>>,
    sessionPhaseRuns: {} as Record<string, ReadonlyArray<Record<string, unknown>>>,
    requestWireframeChange: vi.fn(async (_params: Record<string, unknown>) => undefined),
    settleWireframeDraft: vi.fn(),
    restoreArtifactRevision: vi.fn(async (_params: Record<string, unknown>) => undefined),
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

vi.mock('../../../artifacts/artifacts', () => ({
  listArtifactRevisions: vi.fn(async () => revisions.rows),
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

const postFromFrame = ({ source, data }: { readonly source: unknown; readonly data: unknown }) => {
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data, source: source as Window }));
  });
};

beforeEach(() => {
  frame.staged = [];
  frame.released = [];
  revisions.rows = [];
  state.wireframeDrafts = {};
  state.requestWireframeChange.mockClear();
  state.restoreArtifactRevision.mockClear();
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
    postFromFrame({
      source: window,
      data: {
        channel: 'gbframe',
        type: 'navigated',
        path: 'screens/review-batch.html',
        height: 900,
      },
    });
    expect(current()).toContain('Settlement batches');
    postFromFrame({
      source: iframe.contentWindow,
      data: { channel: 'gbframe', type: 'navigated', path: '../escape.html', height: 900 },
    });
    expect(current()).toContain('Settlement batches');
    postFromFrame({
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

  it('opens a state of a screen as its own page', async () => {
    const withStates = {
      ...document,
      version: 2,
      screens: document.screens.map((entry, index) =>
        index === 0 ? { ...entry, states: { empty: { hide: ['review'] }, error: {} } } : entry,
      ),
    };
    renderViewer({ sourceText: JSON.stringify(withStates) });
    await openScreens();
    const rail = screen.getByTestId('wireframe-screen-rail');
    expect(within(rail).getByRole('button', { name: 'Empty' })).toBeDefined();
    fireEvent.click(screen.getByRole('tab', { name: 'Error' }));
    await waitFor(() =>
      expect(screen.getByTestId('wireframe-frame').getAttribute('src')).toMatch(
        /screens\/batches--error\.html$/,
      ),
    );
  });

  it('picks an element on the page and sends it with the request', async () => {
    renderViewer();
    const iframe = (await openScreens()) as HTMLIFrameElement;
    fireEvent.click(screen.getByTestId('wireframe-pick'));
    expect(screen.getByTestId('wireframe-pick').getAttribute('aria-pressed')).toBe('true');
    postFromFrame({
      source: iframe.contentWindow,
      data: { channel: 'gbframe', type: 'picked', nodeId: 'review', label: 'stage label' },
    });
    expect(screen.getByTestId('wireframe-picked-chip').textContent).toContain(
      'Settlement batches › Review',
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Ask for a change' }), {
      target: { value: 'Make Review the only primary' },
    });
    fireEvent.click(screen.getByTestId('wireframe-change-send'));
    expect(state.requestWireframeChange).toHaveBeenCalledWith(
      expect.objectContaining({
        ask: 'Make Review the only primary',
        scope: 'screen',
        screenId: 'batches',
        picked: [{ nodeId: 'review', label: 'Review' }],
      }),
    );
  });

  it('keeps the current version on stage while the next one is drafting', async () => {
    state.wireframeDrafts = {
      'wireframe-1': {
        status: 'drafting',
        fromRevision: 1,
        startedAt: 1,
        ask: 'Show who owns each exception',
        scope: 'screen',
        screenId: 'batches',
        picked: [],
      },
    };
    renderViewer();
    await openScreens();
    expect(screen.getByTestId('wireframe-version-pill').textContent).toContain('v2 · Drafting');
    expect(screen.getByTestId('wireframe-draft-progress')).toBeDefined();
    expect(screen.getByTestId('wireframe-frame')).toBeDefined();
    expect(
      (screen.getByRole('textbox', { name: 'Ask for a change' }) as HTMLTextAreaElement).disabled,
    ).toBe(true);
  });

  it('says a version was not kept and asks again with the same request', async () => {
    state.wireframeDrafts = {
      'wireframe-1': {
        status: 'failed',
        fromRevision: 1,
        startedAt: 1,
        ask: 'Link Approve to a summary',
        scope: 'screen',
        screenId: 'batches',
        picked: [],
        reason: 'It linked to a screen that does not exist.',
        detail: 'no screen with id "summary"',
      },
    };
    renderViewer();
    const alert = await waitFor(() => screen.getByText(/v2 was not kept/));
    expect(alert.textContent).toContain('You are still on v1.');
    fireEvent.click(screen.getByRole('button', { name: 'Ask again' }));
    expect(state.requestWireframeChange).toHaveBeenCalledWith(
      expect.objectContaining({ ask: 'Link Approve to a summary' }),
    );
  });

  it('shows an older version with the way back and restores it', async () => {
    revisions.rows = [
      {
        revision: 2,
        title: 'Settlement review flow',
        sourceText: JSON.stringify(document),
        author: 'agent',
        ask: 'Split exceptions out',
        createdAt: '2026-09-15T11:00:00.000Z',
        summary: { screensChanged: 1 },
      },
      {
        revision: 1,
        title: 'Settlement review flow',
        sourceText: JSON.stringify(document),
        author: 'agent',
        ask: null,
        createdAt: '2026-09-15T10:00:00.000Z',
        summary: null,
      },
    ];
    renderViewer({ revision: 2 });
    fireEvent.click(screen.getByTestId('wireframe-version-pill'));
    const rows = await waitFor(() => {
      const found = screen.getAllByTestId('wireframe-version-row');
      expect(found).toHaveLength(2);
      return found;
    });
    expect(rows[0]?.textContent).toContain('Split exceptions out');
    expect(rows[0]?.textContent).toContain('1 screen changed');
    expect(rows[1]?.textContent).toContain('First draft');
    fireEvent.click(within(rows[1] as HTMLElement).getByRole('button', { name: 'View' }));
    expect(screen.getByText('You are viewing v1 of 2.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Restore v1' }));
    expect(state.restoreArtifactRevision).toHaveBeenCalledWith(
      expect.objectContaining({ revision: 1 }),
    );
  });

  it('compares two versions side by side with the changes in words', async () => {
    const older = {
      ...document,
      screens: document.screens.map((entry, index) =>
        index === 0
          ? {
              ...entry,
              root: {
                ...entry.root,
                children: [
                  { id: 'batches-title', kind: 'text', text: 'Old batches', variant: 'title' },
                  ...entry.root.children.slice(1),
                  { id: 'legacy', kind: 'text', text: 'Legacy filter' },
                ],
              },
            }
          : entry,
      ),
    };
    revisions.rows = [
      {
        revision: 2,
        title: 'Settlement review flow',
        sourceText: JSON.stringify(document),
        author: 'agent',
        ask: 'Rename the title',
        createdAt: '2026-09-15T11:00:00.000Z',
        summary: null,
      },
      {
        revision: 1,
        title: 'Settlement review flow',
        sourceText: JSON.stringify(older),
        author: 'agent',
        ask: null,
        createdAt: '2026-09-15T10:00:00.000Z',
        summary: null,
      },
    ];
    renderViewer({ revision: 2 });
    fireEvent.click(screen.getByTestId('wireframe-version-pill'));
    const rows = await waitFor(() => {
      const found = screen.getAllByTestId('wireframe-version-row');
      expect(found).toHaveLength(2);
      return found;
    });
    fireEvent.click(within(rows[1] as HTMLElement).getByRole('button', { name: 'Compare' }));
    const bar = await waitFor(() => screen.getByTestId('wireframe-compare-bar'));
    expect(bar.textContent).toContain('Rename the title');
    const badges = screen.getAllByTestId('wireframe-compare-badge');
    expect(badges.map((badge) => badge.textContent)).toEqual(['~ Changed', '= Same']);
    const list = screen.getByTestId('wireframe-change-list');
    expect(list.textContent).toContain('Batches: text changed');
    expect(list.textContent).toContain('Legacy filter: removed');
    await waitFor(() => expect(frame.staged.length).toBeGreaterThanOrEqual(3));
    const staged = frame.staged
      .flat()
      .map((file) => file.contents)
      .join('');
    expect(staged).toContain('data-diff="changed"');
    expect(staged).toContain('data-diff="removed"');
    fireEvent.click(screen.getByTestId('wireframe-compare-exit'));
    expect(screen.queryByTestId('wireframe-compare')).toBeNull();
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
