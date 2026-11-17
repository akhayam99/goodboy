// @vitest-environment happy-dom

import { brandId } from '@goodboy/types';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ArtifactId, SessionId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import type { TerminalTabId } from '../../../shared/types/terminal';
import { importStore, resetStoryStore, type StoryStore } from '../../storyHarness';
import { panelsOf } from './panelsOf';
import type { DrawerRequest } from './state';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).dbLibModuleMock(),
);

const SESSION_ID = brandId<SessionId>({ value: 'session-1' });
const OTHER_SESSION_ID = brandId<SessionId>({ value: 'session-2' });

const TERMINAL: DrawerRequest = {
  kind: 'terminal',
  sessionId: SESSION_ID,
  payload: { terminalId: brandId<TerminalTabId>({ value: 'term-1' }) },
};

const BROWSER: DrawerRequest = { kind: 'browser', sessionId: null, payload: null };

const PLAN: DrawerRequest = {
  kind: 'artifact-document',
  sessionId: SESSION_ID,
  payload: { artifactId: brandId<ArtifactId>({ value: 'plan-1' }), revision: null },
};

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
});

const view = () => {
  const state = store.getState();
  const panels = panelsOf({ top: state.drawer, back: state.drawerBack, grid: state.drawerGrid });
  return {
    dock: panels.dock?.kind ?? null,
    detail: panels.detail?.kind ?? null,
    tools: panels.tools.map((column) => column.map((panel) => panel.kind)),
    focus: panels.focus,
  };
};

type ToolParams = {
  readonly kind: DrawerRequest['kind'];
};

const toolOf = ({ kind }: ToolParams) => {
  const panel = store
    .getState()
    .drawerGrid.columns.flat()
    .find((entry) => entry.kind === kind);
  if (panel === undefined) {
    throw new Error(`${kind} is in the grid`);
  }
  return panel;
};

describe('the drawer slice holds a grid', () => {
  beforeEach(async () => {
    await resetStoryStore();
    store.setState({
      sessions: [aSession({ id: SESSION_ID }), aSession({ id: OTHER_SESSION_ID })],
      currentSessionId: SESSION_ID,
    });
  });

  it('opens two tools together and focuses the latest', () => {
    store.getState().openDrawer(TERMINAL);
    store.getState().openDrawer(BROWSER);

    expect(view()).toEqual({
      dock: 'browser',
      detail: null,
      tools: [['terminal'], ['browser']],
      focus: { at: 'tool', kind: 'browser' },
    });
  });

  it('focuses the detail when a detail opens beside the tools', () => {
    store.getState().openDrawer(TERMINAL);
    store.getState().openDrawer(PLAN);

    expect(view()).toEqual({
      dock: 'terminal',
      detail: 'artifact-document',
      tools: [['terminal']],
      focus: { at: 'detail' },
    });
  });

  it('keeps a tool the detail pushed out of the dock, and brings it back when the other closes', () => {
    store.getState().openDrawer(TERMINAL);
    store.getState().openDrawer(BROWSER);
    store.getState().openDrawer(PLAN);
    expect(view().tools).toEqual([['terminal'], ['browser']]);

    store.getState().closeDrawerEntry({ entry: toolOf({ kind: 'browser' }) });

    expect(view()).toEqual({
      dock: 'terminal',
      detail: 'artifact-document',
      tools: [['terminal']],
      focus: { at: 'detail' },
    });
  });

  it('moves the focus to the latest tool when the focused detail closes, then to the page', () => {
    store.getState().openDrawer(BROWSER);
    store.getState().openDrawer(PLAN);

    store.getState().closeDrawer();
    expect(view()).toEqual({
      dock: 'browser',
      detail: null,
      tools: [['browser']],
      focus: { at: 'tool', kind: 'browser' },
    });

    store.getState().closeDrawer();
    expect(view()).toEqual({ dock: null, detail: null, tools: [], focus: { at: 'page' } });
  });

  it('toggles a tool off from the rail and out of the grid', () => {
    store.getState().openDrawer(TERMINAL);
    store.getState().openDrawer(BROWSER);

    store.getState().toggleDrawer(BROWSER);

    expect(view()).toEqual({
      dock: 'terminal',
      detail: null,
      tools: [['terminal']],
      focus: { at: 'tool', kind: 'terminal' },
    });
  });

  it('moves the focus between the page, the detail and a tool', () => {
    store.getState().openDrawer(BROWSER);
    store.getState().openDrawer(PLAN);
    const detail = store.getState().drawer;
    if (detail === null) {
      throw new Error('the detail is open');
    }

    store.getState().focusDrawerPanel({ target: { at: 'page' } });
    expect(view().focus).toEqual({ at: 'page' });

    store
      .getState()
      .focusDrawerPanel({ target: { at: 'panel', entry: toolOf({ kind: 'browser' }) } });
    expect(view().focus).toEqual({ at: 'tool', kind: 'browser' });

    store.getState().focusDrawerPanel({ target: { at: 'panel', entry: detail } });
    expect(view().focus).toEqual({ at: 'detail' });
  });

  it('brings a tool hidden in the grid into the dock when it takes the focus', () => {
    store.getState().openDrawer(TERMINAL);
    store.getState().openDrawer(BROWSER);
    store.getState().openDrawer(PLAN);
    expect(view().dock).toBe('browser');

    store
      .getState()
      .focusDrawerPanel({ target: { at: 'panel', entry: toolOf({ kind: 'terminal' }) } });

    expect(view()).toEqual({
      dock: 'terminal',
      detail: 'artifact-document',
      tools: [['terminal'], ['browser']],
      focus: { at: 'tool', kind: 'terminal' },
    });
  });

  it('drops a focus or a close aimed at a tool another open already replaced', () => {
    store.getState().openDrawer(TERMINAL);
    const stale = toolOf({ kind: 'terminal' });
    store.getState().openDrawer({ ...TERMINAL, sessionId: OTHER_SESSION_ID });
    store.getState().openDrawer(BROWSER);
    const before = store.getState().drawerGrid;

    store.getState().focusDrawerPanel({ target: { at: 'panel', entry: stale } });
    store.getState().closeDrawerEntry({ entry: stale });

    expect(store.getState().drawerGrid).toBe(before);
    expect(toolOf({ kind: 'terminal' }).sessionId).toBe(OTHER_SESSION_ID);
  });

  it('drops a focus aimed at a detail that is no longer open', () => {
    store.getState().openDrawer(PLAN);
    const stale = store.getState().drawer;
    if (stale === null) {
      throw new Error('the detail is open');
    }
    store.getState().closeDrawer();
    store.getState().openDrawer(BROWSER);
    const before = store.getState().drawerGrid;

    store.getState().focusDrawerPanel({ target: { at: 'panel', entry: stale } });

    expect(store.getState().drawerGrid).toBe(before);
  });

  it('takes only the tools of the session that is gone out of the grid', async () => {
    store.getState().openDrawer(TERMINAL);
    store.getState().openDrawer(BROWSER);

    await store.getState().archiveTask(SESSION_ID);

    expect(view()).toEqual({
      dock: 'browser',
      detail: null,
      tools: [['browser']],
      focus: { at: 'tool', kind: 'browser' },
    });
  });

  it('empties the grid with the slot', () => {
    store.getState().openDrawer(TERMINAL);
    store.getState().openDrawer(BROWSER);

    store.getState().clearDrawer();

    expect(view()).toEqual({ dock: null, detail: null, tools: [], focus: { at: 'page' } });
  });

  it('gives a second window its own grid', async () => {
    store.getState().openDrawer(TERMINAL);
    vi.resetModules();
    const second = await importStore();

    second.getState().openDrawer(BROWSER);

    expect(
      second
        .getState()
        .drawerGrid.columns.flat()
        .map((panel) => panel.kind),
    ).toEqual(['browser']);
    expect(view().tools).toEqual([['terminal']]);
  });
});
