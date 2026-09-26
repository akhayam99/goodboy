// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const { state } = vi.hoisted(() => ({
  state: {
    transcripts: {} as Record<string, ReadonlyArray<Record<string, unknown>>>,
    sessionPhaseRuns: {} as Record<string, ReadonlyArray<Record<string, unknown>>>,
    spawnWireframeAgent: vi.fn(async () => 'agent-wireframe'),
  },
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [] as readonly never[],
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

import { WireframeStudio } from './index';
import { chooseListboxValue } from '../../../../__tests__/helpers/listbox';

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

const renderScreens = (overrides: Record<string, unknown> = {}) => {
  const view = renderStudio(overrides);
  fireEvent.click(screen.getByRole('tab', { name: 'Screens' }));
  return view;
};

const selectScreen = (screenId: string) =>
  chooseListboxValue({ trigger: screen.getByTestId('wireframe-screen-select'), value: screenId });

const currentScreen = () => screen.getByTestId('wireframe-screen').getAttribute('data-screen-id');

const PANE_WIDTH = 640;

type StubBoxParams = Readonly<{ key: 'clientWidth' | 'offsetHeight'; value: number }>;

const stubBox = ({ key, value }: StubBoxParams): (() => void) => {
  const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, key);
  Object.defineProperty(HTMLElement.prototype, key, { configurable: true, value });
  return () => {
    if (original === undefined) {
      Reflect.deleteProperty(HTMLElement.prototype, key);
      return;
    }
    Object.defineProperty(HTMLElement.prototype, key, original);
  };
};

let restoreClientWidth: () => void = () => undefined;

beforeEach(() => {
  state.transcripts = {};
  state.sessionPhaseRuns = {};
  state.spawnWireframeAgent.mockClear();
  restoreClientWidth = stubBox({ key: 'clientWidth', value: PANE_WIDTH });
});
afterEach(() => {
  restoreClientWidth();
  cleanup();
});

describe('WireframeStudio', () => {
  it('opens on the flow, with the screens as a grid under it', () => {
    renderStudio();
    expect(screen.getByTestId('wireframe-studio').getAttribute('data-view')).toBe('flow');
    expect(screen.getByTestId('wireframe-flow-overview')).toBeDefined();
    expect(screen.getAllByTestId('wireframe-sheet-frame')).toHaveLength(3);
    expect(screen.getByTestId('wireframe-flow-legend')).toBeDefined();
    expect(screen.queryByTestId('wireframe-canvas')).toBeNull();
  });

  it('offers two views, Flow and Screens, and no separate contact sheet', () => {
    renderStudio();
    const views = screen.getByRole('tablist', { name: 'Wireframe view' });
    expect([...views.querySelectorAll('[role="tab"]')].map((tab) => tab.textContent)).toEqual([
      'Flow',
      'Screens',
    ]);
  });

  it('renders the initial screen with a screen select that counts its place', () => {
    renderScreens();
    expect(currentScreen()).toBe('inbox');
    fireEvent.click(screen.getByTestId('wireframe-screen-select'));
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Inbox',
      'Message',
      'Archive',
    ]);
    expect(screen.getByText('1/3')).toBeDefined();
  });

  it('leaves provenance and fidelity to the detail band, not to the canvas column', () => {
    renderStudio();
    expect(screen.queryByTestId('wireframe-provenance')).toBeNull();
    expect(screen.queryByTestId('wireframe-fidelity-divergence')).toBeNull();
    expect(screen.queryByTestId('wireframe-source-chip')).toBeNull();
  });

  it('renders an image node as a labelled placeholder, never a remote asset', () => {
    const { container } = renderScreens();
    expect(screen.getByRole('img', { name: 'chart placeholder (placeholder)' })).toBeDefined();
    expect(container.querySelectorAll('img')).toHaveLength(0);
  });

  it('navigates through a hotspot', () => {
    renderScreens();
    fireEvent.click(screen.getByText('Open message'));
    expect(currentScreen()).toBe('message');
    expect(screen.getByText('2/3')).toBeDefined();
  });

  it('navigates from a node whose only action is a declared transition', () => {
    renderScreens();
    fireEvent.click(screen.getByText('Go to archive'));
    expect(currentScreen()).toBe('archive');
  });

  it('reserves the scroll box from the real height of the screen', () => {
    const restore = stubBox({ key: 'offsetHeight', value: 1200 });
    renderScreens();
    const box = screen.getByTestId('wireframe-screen').parentElement;
    expect(box?.style.height).toBe(`${1200 * 0.47}px`);
    restore();
  });

  it('fits a screen taller than the pane on its height, not on its width', () => {
    const restore = stubBox({ key: 'offsetHeight', value: 1200 });
    renderScreens();
    expect(screen.getByText(/%$/).textContent).toBe('47%');
    const canvas = screen.getByTestId('wireframe-canvas');
    expect(canvas.style.maxHeight).toBe('744px');
    selectScreen('archive');
    expect(screen.getByText(/%$/).textContent).toBe('59%');
    const drawn = screen.getByTestId('wireframe-screen').parentElement;
    expect(Number.parseFloat(drawn?.style.height ?? '0')).toBeLessThanOrEqual(744);
    restore();
  });

  it('keeps the screen select and the canvas controls on one toolbar band', () => {
    renderScreens();
    const toolbar = screen.getByTestId('wireframe-toolbar');
    expect(toolbar.contains(screen.getByTestId('wireframe-screen-select'))).toBe(true);
    expect(toolbar.contains(screen.getByTestId('wireframe-zoom-fit'))).toBe(true);
  });

  it('leaves the variant action to the identity band instead of the canvas controls', () => {
    renderScreens();
    expect(screen.queryByTestId('wireframe-convert-fidelity')).toBeNull();
  });

  it('opens on the toolbar, with the canvas as the first thing under it', () => {
    renderScreens();
    const canvas = screen.getByTestId('wireframe-canvas');
    const toolbar = screen.getByTestId('wireframe-toolbar');
    expect(canvas.compareDocumentPosition(toolbar) & Node.DOCUMENT_POSITION_PRECEDING).toBe(
      Node.DOCUMENT_POSITION_PRECEDING,
    );
    expect(toolbar.parentElement?.firstElementChild).toBe(toolbar);
  });

  it('walks the screens in document order with previous and next', () => {
    renderScreens();
    expect(screen.getByTestId('wireframe-previous').hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByTestId('wireframe-next'));
    expect(currentScreen()).toBe('message');
    fireEvent.click(screen.getByTestId('wireframe-next'));
    expect(currentScreen()).toBe('archive');
    expect(screen.getByTestId('wireframe-next').hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByTestId('wireframe-previous'));
    expect(currentScreen()).toBe('message');
  });

  it('opens a screen from a node of the flow', () => {
    renderStudio();
    fireEvent.click(screen.getByRole('button', { name: 'Go to Archive' }));
    expect(screen.getByTestId('wireframe-studio').getAttribute('data-view')).toBe('screen');
    expect(currentScreen()).toBe('archive');
  });

  it('fits the desktop screen to the pane on mount and refits on a screen change', () => {
    renderScreens();
    expect(screen.getByText(/%$/).textContent).toBe('47%');
    selectScreen('archive');
    expect(currentScreen()).toBe('archive');
    expect(screen.getByText(/%$/).textContent).toBe('110%');
  });

  it('keeps a manual zoom and the selection across a screen switch', () => {
    renderScreens();
    fireEvent.click(screen.getByText('Inbox', { selector: 'p' }));
    fireEvent.click(screen.getByTestId('wireframe-zoom-in'));
    expect(screen.getByText(/%$/).textContent).toBe('57%');
    selectScreen('archive');
    expect(currentScreen()).toBe('archive');
    expect(screen.getByText(/%$/).textContent).toBe('57%');
    fireEvent.click(screen.getByTestId('wireframe-zoom-out'));
    expect(screen.getByText(/%$/).textContent).toBe('47%');
    selectScreen('inbox');
    const heading = screen.getByText('Inbox', { selector: 'p' });
    expect(heading.getAttribute('style')).toContain('outline');
  });

  it('returns to the fitted view when Fit is pressed after a manual zoom', () => {
    renderScreens();
    fireEvent.click(screen.getByTestId('wireframe-zoom-in'));
    fireEvent.click(screen.getByTestId('wireframe-zoom-in'));
    expect(screen.getByText(/%$/).textContent).toBe('67%');
    fireEvent.click(screen.getByTestId('wireframe-zoom-fit'));
    expect(screen.getByText(/%$/).textContent).toBe('47%');
    selectScreen('archive');
    expect(screen.getByText(/%$/).textContent).toBe('110%');
  });

  it('toggles declared mock state instead of navigating', () => {
    renderScreens();
    expect(screen.queryByTestId('wireframe-mock-state')).toBeNull();
    fireEvent.click(screen.getByText('Filters'));
    expect(currentScreen()).toBe('inbox');
    expect(screen.getByTestId('wireframe-mock-state').textContent).toContain('isFilterOpen');
  });

  it('keeps the mock state as a chip inside the toolbar', () => {
    renderScreens();
    expect(screen.queryByTestId('wireframe-mock-state')).toBeNull();
    fireEvent.click(screen.getByText('Filters'));
    const chip = screen.getByTestId('wireframe-mock-state');
    expect(screen.getByTestId('wireframe-toolbar').contains(chip)).toBe(true);
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
    expect(issues.textContent).not.toContain('unknown property');
    expect(container.querySelectorAll('script')).toHaveLength(0);
    expect(screen.getByTestId('artifact-json-source').textContent).toContain('"screens"');
  });

  it('draws a document whose spacing tokens are outside the enum and says what it moved', () => {
    const drifted = {
      ...document,
      screens: [
        {
          ...document.screens[0],
          root: {
            id: 'inbox-root',
            kind: 'stack',
            direction: 'column',
            gap: 'xl',
            children: [
              { id: 'inbox-heading', kind: 'text', text: 'Inbox', variant: 'title' },
              {
                id: 'inbox-body',
                kind: 'stack',
                direction: 'column',
                gap: 'xs',
                width: 320,
                children: [{ id: 'inbox-note', kind: 'text', text: 'Nothing new' }],
              },
            ],
          },
        },
        document.screens[1],
        document.screens[2],
      ],
      transitions: [],
    };
    renderScreens({ sourceText: JSON.stringify(drifted) });
    expect(screen.getByTestId('wireframe-canvas')).toBeDefined();
    expect(screen.queryByTestId('wireframe-issues')).toBeNull();
    const adjustments = screen.getByTestId('wireframe-adjustments');
    expect(adjustments.textContent).toContain(
      'some values were moved and some properties were dropped to draw this wireframe',
    );
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    expect(adjustments.textContent).toContain('screens[0].root.gap');
    expect(adjustments.textContent).toContain('so it was drawn as lg');
    expect(adjustments.textContent).toContain('so it was drawn as sm');
    expect(adjustments.textContent).toContain('screens[0].root.children[1].width');
    expect(adjustments.textContent).toContain('so it was dropped');
    expect(adjustments.textContent).not.toContain('places');
  });

  it('collapses a drift repeated across nodes into one row that counts the places', () => {
    const repeated = {
      ...document,
      screens: [
        {
          ...document.screens[0],
          root: {
            id: 'inbox-root',
            kind: 'stack',
            direction: 'column',
            children: Array.from({ length: 6 }, (_unused, index) => ({
              id: `card-${index}`,
              kind: 'stack',
              direction: 'column',
              gap: 'xl',
              children: [],
            })),
          },
        },
        document.screens[1],
        document.screens[2],
      ],
      transitions: [],
    };
    renderStudio({ sourceText: JSON.stringify(repeated) });
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    const rows = screen.getByTestId('wireframe-adjustments').querySelectorAll('li');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.textContent).toContain('screens[0].root.children[0].gap');
    expect(rows[0]?.textContent).toContain('(6 places)');
  });

  it('does not claim a value was moved when the only adjustment is a dropped key', () => {
    const droppedOnly = {
      ...document,
      screens: [
        {
          ...document.screens[0],
          root: {
            id: 'inbox-root',
            kind: 'stack',
            direction: 'column',
            width: 320,
            children: [{ id: 'inbox-note', kind: 'text', text: 'Nothing new' }],
          },
        },
        document.screens[1],
        document.screens[2],
      ],
      transitions: [],
    };
    renderStudio({ sourceText: JSON.stringify(droppedOnly) });
    const adjustments = screen.getByTestId('wireframe-adjustments');
    expect(adjustments.textContent).toContain(
      'some properties were dropped to draw this wireframe',
    );
    expect(adjustments.textContent).not.toContain('moved');
  });

  it('counts places on a listed row and never on the aggregate row', () => {
    const rogue = Object.fromEntries(
      Array.from({ length: 26 }, (_unused, index) => [`rogue${index}`, 1]),
    );
    const noisy = {
      ...document,
      screens: [
        {
          ...document.screens[0],
          root: {
            id: 'inbox-root',
            kind: 'stack',
            direction: 'column',
            ...rogue,
            children: [
              { id: 'inbox-a', kind: 'stack', direction: 'column', gap: 'xl', children: [] },
              { id: 'inbox-b', kind: 'stack', direction: 'column', gap: 'xl', children: [] },
            ],
          },
        },
        document.screens[1],
        document.screens[2],
      ],
      transitions: [],
    };
    renderStudio({ sourceText: JSON.stringify(noisy) });
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    const rows = [...screen.getByTestId('wireframe-adjustments').querySelectorAll('li')];
    const last = rows[rows.length - 1];
    expect(last?.textContent).toBe('and 1 more value moved and 2 more keys dropped');
    expect(last?.textContent).not.toContain('places');
    expect(rows.some((row) => row.textContent?.includes('rogue0'))).toBe(true);
  });

  it('names all three kinds in the trigger when all three happened', () => {
    const everything = {
      ...document,
      screens: [
        {
          ...document.screens[0],
          root: {
            id: 'inbox-root',
            kind: 'stack',
            direction: 'column',
            gap: 'xl',
            width: 320,
            children: [{ id: 'inbox-note', kind: 'text', text: 'a'.repeat(900) }],
          },
        },
        document.screens[1],
        document.screens[2],
      ],
      transitions: [],
    };
    renderStudio({ sourceText: JSON.stringify(everything) });
    const adjustments = screen.getByTestId('wireframe-adjustments');
    expect(adjustments.textContent).toContain(
      'some values were moved, some text was shortened and some properties were dropped to draw this wireframe',
    );
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    expect(adjustments.textContent).toContain('so it was shortened to fit');
  });

  it('says nothing about adjustments when the document already matches the contract', () => {
    renderStudio();
    expect(screen.queryByTestId('wireframe-adjustments')).toBeNull();
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

  it('follows a hotspot inside the sheet without leaving the sheet', () => {
    renderStudio();
    const frames = () =>
      screen
        .getAllByTestId('wireframe-sheet-frame')
        .filter((frame) => frame.getAttribute('data-current') === 'true')
        .map((frame) => frame.getAttribute('data-screen-id'));
    expect(frames()).toEqual(['inbox']);
    fireEvent.click(screen.getByText('Open message'));
    expect(frames()).toEqual(['message']);
    expect(screen.getByTestId('wireframe-contact-sheet')).toBeDefined();
    fireEvent.click(screen.getByRole('tab', { name: 'Screens' }));
    expect(currentScreen()).toBe('message');
  });

  it('opens one frame on its own from the sheet', () => {
    renderStudio();
    const opens = screen.getAllByTestId('wireframe-sheet-open');
    fireEvent.click(opens[2] as HTMLElement);
    expect(currentScreen()).toBe('archive');
    expect(screen.queryByTestId('wireframe-contact-sheet')).toBeNull();
  });

  it('swaps the flow and its grid for the clickable screen and back', () => {
    renderStudio();
    expect(screen.queryByTestId('wireframe-zoom-fit')).toBeNull();
    expect(screen.queryByTestId('wireframe-screen-select')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Screens' }));
    expect(currentScreen()).toBe('inbox');
    expect(screen.queryByTestId('wireframe-contact-sheet')).toBeNull();
    expect(screen.queryByTestId('wireframe-flow-overview')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Flow' }));
    expect(screen.getByTestId('wireframe-contact-sheet')).toBeDefined();
  });
});
