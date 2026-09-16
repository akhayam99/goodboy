// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const { state } = vi.hoisted(() => ({
  state: {
    transcripts: {} as Record<string, ReadonlyArray<Record<string, unknown>>>,
    spawnWireframeAgent: vi.fn(async () => 'agent-wireframe'),
  },
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [] as readonly never[],
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

import { WireframeStudio } from './index';

const SESSION_ID = JSON.parse(JSON.stringify('session-1'));

const document = {
  version: 1,
  initialScreenId: 'inbox',
  theme: { name: 'goodboy', font: 'sans', radius: 'md', sources: ['packages/ui/src/styles.css'] },
  mockState: { isFilterOpen: false },
  screens: [
    {
      id: 'inbox',
      title: 'Inbox',
      viewport: 'desktop',
      root: {
        id: 'inbox-root',
        kind: 'stack',
        direction: 'column',
        children: [
          { id: 'inbox-heading', kind: 'text', text: 'Inbox', variant: 'title' },
          {
            id: 'inbox-open',
            kind: 'button',
            label: 'Open message',
            variant: 'primary',
            action: { type: 'navigate', toScreenId: 'message' },
          },
          {
            id: 'inbox-filter',
            kind: 'button',
            label: 'Filters',
            action: { type: 'toggle', stateKey: 'isFilterOpen' },
          },
          { id: 'inbox-hero', kind: 'image', alt: 'chart placeholder', ratio: 'wide' },
          { id: 'inbox-archive', kind: 'button', label: 'Go to archive', variant: 'ghost' },
        ],
      },
    },
    {
      id: 'message',
      title: 'Message',
      viewport: 'desktop',
      root: {
        id: 'message-root',
        kind: 'stack',
        direction: 'column',
        children: [{ id: 'message-title', kind: 'text', text: 'Release is ready' }],
      },
    },
    {
      id: 'archive',
      title: 'Archive',
      viewport: 'mobile',
      root: {
        id: 'archive-root',
        kind: 'stack',
        direction: 'column',
        children: [{ id: 'archive-title', kind: 'text', text: 'Archive' }],
      },
    },
  ],
  transitions: [
    { fromNodeId: 'inbox-open', toScreenId: 'message', label: 'open message' },
    { fromNodeId: 'inbox-archive', toScreenId: 'archive', label: 'go to archive' },
  ],
};

const artifact = {
  id: 'wireframe-1',
  sessionId: SESSION_ID,
  agentId: 'agent-wireframe',
  workflowRunId: null,
  kind: 'wireframe',
  schemaVersion: 1,
  title: 'Inbox flow',
  sourceFormat: 'json',
  sourceText: JSON.stringify(document),
  metadata: { fidelity: 'low', designProfile: { commitSha: 'abcdef1' } },
  status: 'active',
  revision: 1,
  sourceTurnId: 'run-1',
  createdAt: '2026-09-15T10:00:00.000Z',
  updatedAt: '2026-09-15T10:00:00.000Z',
};

const renderStudio = (overrides: Record<string, unknown> = {}) =>
  render(
    <WireframeStudio
      sessionId={SESSION_ID}
      artifact={JSON.parse(JSON.stringify({ ...artifact, ...overrides }))}
    />,
  );

const currentScreen = () => screen.getByTestId('wireframe-screen').getAttribute('data-screen-id');

const PANE_WIDTH = 640;

beforeEach(() => {
  state.transcripts = {};
  state.spawnWireframeAgent.mockClear();
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    value: PANE_WIDTH,
  });
});
afterEach(() => {
  Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth');
  cleanup();
});

describe('WireframeStudio', () => {
  it('renders the initial screen with its tabs and provenance', () => {
    renderStudio();
    expect(currentScreen()).toBe('inbox');
    expect(screen.getByRole('tab', { name: /Inbox/ })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Archive/ })).toBeDefined();
    const provenance = screen.getByTestId('wireframe-provenance');
    expect(provenance.textContent).toContain('low fidelity');
    expect(provenance.textContent).toContain('theme goodboy');
    expect(provenance.textContent).toContain('abcdef1');
    expect(provenance.textContent).toContain('packages/ui/src/styles.css');
  });

  it('renders an image node as a labelled placeholder, never a remote asset', () => {
    const { container } = renderStudio();
    expect(screen.getByRole('img', { name: 'chart placeholder (placeholder)' })).toBeDefined();
    expect(container.querySelectorAll('img')).toHaveLength(0);
  });

  it('navigates through a hotspot and back and forward through the history', () => {
    renderStudio();
    fireEvent.click(screen.getByText('Open message'));
    expect(currentScreen()).toBe('message');
    fireEvent.click(screen.getByTestId('wireframe-back'));
    expect(currentScreen()).toBe('inbox');
    fireEvent.click(screen.getByTestId('wireframe-forward'));
    expect(currentScreen()).toBe('message');
  });

  it('navigates from a node whose only action is a declared transition', () => {
    renderStudio();
    fireEvent.click(screen.getByText('Go to archive'));
    expect(currentScreen()).toBe('archive');
  });

  it('reserves the scroll box from the real height of the screen', () => {
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      value: 1200,
    });
    renderStudio();
    const box = screen.getByTestId('wireframe-screen').parentElement;
    expect(box?.style.height).toBe(`${1200 * 0.47}px`);
    Reflect.deleteProperty(HTMLElement.prototype, 'offsetHeight');
  });

  it('walks the screens in document order with previous and next', () => {
    renderStudio();
    expect(screen.getByTestId('wireframe-previous').hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByTestId('wireframe-next'));
    expect(currentScreen()).toBe('message');
    fireEvent.click(screen.getByTestId('wireframe-next'));
    expect(currentScreen()).toBe('archive');
    expect(screen.getByTestId('wireframe-next').hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByTestId('wireframe-previous'));
    expect(currentScreen()).toBe('message');
  });

  it('jumps to a screen from the flow overview', () => {
    renderStudio();
    expect(screen.getByTestId('wireframe-flow-overview')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Go to Archive' }));
    expect(currentScreen()).toBe('archive');
  });

  it('fits the desktop screen to the pane on mount and refits on a screen change', () => {
    renderStudio();
    expect(screen.getByText(/%$/).textContent).toBe('47%');
    fireEvent.click(screen.getByRole('tab', { name: /Archive/ }));
    expect(currentScreen()).toBe('archive');
    expect(screen.getByText(/%$/).textContent).toBe('150%');
  });

  it('keeps a manual zoom and the selection across a screen switch', () => {
    renderStudio();
    fireEvent.click(screen.getByText('Inbox', { selector: 'p' }));
    fireEvent.click(screen.getByTestId('wireframe-zoom-in'));
    expect(screen.getByText(/%$/).textContent).toBe('57%');
    fireEvent.click(screen.getByRole('tab', { name: /Archive/ }));
    expect(currentScreen()).toBe('archive');
    expect(screen.getByText(/%$/).textContent).toBe('57%');
    fireEvent.click(screen.getByTestId('wireframe-zoom-out'));
    expect(screen.getByText(/%$/).textContent).toBe('47%');
    fireEvent.click(screen.getByRole('tab', { name: /Inbox/ }));
    const heading = screen.getByText('Inbox', { selector: 'p' });
    expect(heading.getAttribute('style')).toContain('outline');
  });

  it('returns to the fitted view when Fit is pressed after a manual zoom', () => {
    renderStudio();
    fireEvent.click(screen.getByTestId('wireframe-zoom-in'));
    fireEvent.click(screen.getByTestId('wireframe-zoom-in'));
    expect(screen.getByText(/%$/).textContent).toBe('67%');
    fireEvent.click(screen.getByTestId('wireframe-zoom-fit'));
    expect(screen.getByText(/%$/).textContent).toBe('47%');
    fireEvent.click(screen.getByRole('tab', { name: /Archive/ }));
    expect(screen.getByText(/%$/).textContent).toBe('150%');
  });

  it('toggles declared mock state instead of navigating', () => {
    renderStudio();
    expect(screen.queryByTestId('wireframe-mock-state')).toBeNull();
    fireEvent.click(screen.getByText('Filters'));
    expect(currentScreen()).toBe('inbox');
    expect(screen.getByTestId('wireframe-mock-state').textContent).toContain('isFilterOpen');
  });

  it('offers the other fidelity as a separate variant and spawns it', async () => {
    renderStudio();
    const convert = screen.getByTestId('wireframe-convert-fidelity');
    expect(convert.textContent).toContain('New repository styled variant');
    expect(convert.getAttribute('title')).toContain('leaving this one untouched');
    fireEvent.click(convert);
    await waitFor(() => {
      expect(state.spawnWireframeAgent).toHaveBeenCalledWith({
        sessionId: SESSION_ID,
        fidelity: 'high',
        workflowRunId: null,
      });
    });
  });

  it('shows the validation issues and the raw json for a hostile payload', () => {
    const hostile = {
      version: 1,
      initialScreenId: 'evil',
      screens: [
        {
          id: 'evil',
          title: 'Evil',
          viewport: 'desktop',
          root: {
            id: 'evil-root',
            kind: 'text',
            text: '<script>alert(1)</script>',
            onClick: 'steal()',
          },
        },
      ],
      transitions: [],
    };
    const { container } = renderStudio({ sourceText: JSON.stringify(hostile) });
    expect(screen.queryByTestId('wireframe-canvas')).toBeNull();
    const issues = screen.getByTestId('wireframe-issues');
    expect(issues.textContent).toContain('raw html is not allowed');
    expect(issues.textContent).toContain('unknown property');
    expect(container.querySelectorAll('script')).toHaveLength(0);
    expect(screen.getByTestId('artifact-json-source').textContent).toContain('"screens"');
  });

  it('shows the issues for a payload that is not json at all', () => {
    renderStudio({ sourceText: 'not json' });
    expect(screen.getByTestId('wireframe-issues').textContent).toContain(
      'the source is not valid JSON',
    );
  });

  it('renders the node note for every node kind, not just the containers', () => {
    const annotated = {
      version: 1,
      initialScreenId: 'notes',
      theme: { name: 'generic' },
      screens: [
        {
          id: 'notes',
          title: 'Notes',
          viewport: 'desktop',
          root: {
            id: 'notes-root',
            kind: 'stack',
            direction: 'column',
            note: 'stack note',
            children: [
              { id: 'notes-text', kind: 'text', text: 'Inbox', note: 'text note' },
              { id: 'notes-button', kind: 'button', label: 'Open', note: 'button note' },
              {
                id: 'notes-input',
                kind: 'input',
                inputType: 'text',
                note: 'input note',
              },
              {
                id: 'notes-list',
                kind: 'list',
                note: 'list note',
                items: [{ id: 'notes-list-1', title: 'A session' }],
              },
              {
                id: 'notes-table',
                kind: 'table',
                note: 'table note',
                columns: ['state'],
                rows: [['done']],
              },
              { id: 'notes-image', kind: 'image', alt: 'chart', note: 'image note' },
              {
                id: 'notes-nav',
                kind: 'navigation',
                variant: 'top',
                note: 'navigation note',
                items: [{ id: 'notes-nav-home', label: 'Home' }],
              },
              {
                id: 'notes-grid',
                kind: 'grid',
                columns: 2,
                note: 'grid note',
                children: [{ id: 'notes-grid-text', kind: 'text', text: 'Cell' }],
              },
            ],
          },
        },
      ],
      transitions: [],
    };
    renderStudio({ sourceText: JSON.stringify(annotated) });
    const notes = screen
      .getAllByTestId('wireframe-annotation')
      .map((element) => element.textContent);
    expect(notes).toEqual(
      expect.arrayContaining([
        'stack note',
        'grid note',
        'text note',
        'button note',
        'input note',
        'list note',
        'table note',
        'image note',
        'navigation note',
      ]),
    );
  });
});
