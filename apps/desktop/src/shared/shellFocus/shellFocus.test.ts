// @vitest-environment happy-dom

import { brandId } from '@goodboy/types';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ArtifactId, SessionId, WorkspaceId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import type { TerminalTabId } from '../types/terminal';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../store/storyHarness';
import { panelFocusKeyOf } from '../../store/slices/drawer/panelFocusKeyOf';
import { shellPanelsOf } from '../../store/slices/drawer/shellPanelsOf';
import type { DrawerRequest } from '../../store/slices/drawer/state';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../store/storyHarness')).dbModuleMock());
vi.mock('../lib/db', async () => (await import('../../store/storyHarness')).dbLibModuleMock());

import { closeSlot } from '../../app/hooks/useAppShortcuts/closeSlot';
import { toggleTerminalDock } from '../../features/terminal/toggleTerminalDock';
import { focusShellPanel } from './focusShellPanel';
import { splitShellColumn } from './splitShellColumn';
import { stepPanelFocus } from './stepPanelFocus';
import { turnShellPair } from './turnShellPair';

const SESSION_ID = brandId<SessionId>({ value: 'session-harborline' });

const TERMINAL: DrawerRequest = {
  kind: 'terminal',
  sessionId: null,
  payload: { terminalId: brandId<TerminalTabId>({ value: 'term-harborline' }) },
};

const BROWSER: DrawerRequest = { kind: 'browser', sessionId: null, payload: null };

const PLAN: DrawerRequest = {
  kind: 'artifact-document',
  sessionId: SESSION_ID,
  payload: { artifactId: brandId<ArtifactId>({ value: 'plan-payments-api' }), revision: null },
};

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  store.setState({
    sessions: [aSession({ id: SESSION_ID })],
    currentSessionId: SESSION_ID,
  });
});

afterEach(() => {
  document.body.innerHTML = '';
});

const focusKey = (): string =>
  panelFocusKeyOf({ panels: shellPanelsOf({ state: store.getState() }) });

const tools = (): ReadonlyArray<ReadonlyArray<string>> =>
  shellPanelsOf({ state: store.getState() }).tools.map((column) =>
    column.map((panel) => panel.kind),
  );

type KeysParams = {
  readonly keys: ReadonlyArray<string>;
};

const mountTargets = ({ keys }: KeysParams): void => {
  keys.forEach((key) => {
    const target = document.createElement('div');
    target.tabIndex = -1;
    target.dataset.dockFocus = key;
    document.body.append(target);
  });
};

const focusedTarget = (): string | null =>
  document.activeElement instanceof HTMLElement
    ? (document.activeElement.dataset.dockFocus ?? null)
    : null;

describe('the frame focus', () => {
  it('walks page, detail and the tools with F6 and back with shift F6, moving the keyboard too', () => {
    store.getState().openDrawer(TERMINAL);
    store.getState().openDrawer(BROWSER);
    store.getState().openDrawer(PLAN);
    mountTargets({ keys: ['page', 'detail', 'terminal', 'browser'] });
    focusShellPanel({ key: 'page' });

    const walk = [1, 1, 1, 1].map(() => {
      stepPanelFocus({ step: 1 });
      return [focusKey(), focusedTarget()];
    });
    stepPanelFocus({ step: -1 });

    expect(walk).toEqual([
      ['detail', 'detail'],
      ['terminal', 'terminal'],
      ['browser', 'browser'],
      ['page', 'page'],
    ]);
    expect(focusKey()).toBe('browser');
    expect(tools()).toEqual([['terminal'], ['browser']]);
  });

  it('writes nothing when the panel named already has the focus', () => {
    store.getState().openDrawer(TERMINAL);
    const before = store.getState();

    focusShellPanel({ key: 'terminal' });

    expect(store.getState()).toBe(before);
  });

  it('closes the focused tool with cmd shift W and keeps the other open', () => {
    store.getState().openDrawer(TERMINAL);
    store.getState().openDrawer(BROWSER);
    focusShellPanel({ key: 'terminal' });

    closeSlot({});

    expect(tools()).toEqual([['browser']]);
  });

  it('closes the focused detail and leaves the tools', () => {
    store.getState().openDrawer(TERMINAL);
    store.getState().openDrawer(PLAN);

    closeSlot({});

    expect(shellPanelsOf({ state: store.getState() }).detail).toBeNull();
    expect(tools()).toEqual([['terminal']]);
  });

  it('focuses an open Terminal with ctrl backtick first, then closes it', () => {
    store.setState({ currentWorkspaceId: brandId<WorkspaceId>({ value: 'ws-northwind' }) });
    store.getState().openDrawer(TERMINAL);
    store.getState().openDrawer(BROWSER);
    mountTargets({ keys: ['terminal', 'browser'] });

    toggleTerminalDock({ isToggle: true, shouldFocusFirst: true });
    expect([focusKey(), focusedTarget(), tools()]).toEqual([
      'terminal',
      'terminal',
      [['terminal'], ['browser']],
    ]);

    toggleTerminalDock({ isToggle: true, shouldFocusFirst: true });
    expect(tools()).toEqual([['browser']]);
  });

  it('closes an open Terminal from its rail button even when it has no focus', () => {
    store.setState({ currentWorkspaceId: brandId<WorkspaceId>({ value: 'ws-northwind' }) });
    store.getState().openDrawer(TERMINAL);
    store.getState().openDrawer(BROWSER);

    toggleTerminalDock({ isToggle: true });

    expect(tools()).toEqual([['browser']]);
  });

  it('turns the pair between side by side and stacked, and focuses the panel it came from', () => {
    store.getState().openDrawer(TERMINAL);
    store.getState().openDrawer(BROWSER);

    turnShellPair({ key: 'terminal' });
    expect([tools(), focusKey()]).toEqual([[['terminal', 'browser']], 'terminal']);

    turnShellPair({ key: 'browser' });
    expect([tools(), focusKey()]).toEqual([[['terminal'], ['browser']], 'browser']);
  });

  it('turns nothing once the named panel has closed', () => {
    store.getState().openDrawer(TERMINAL);
    store.getState().openDrawer(BROWSER);
    const terminal = store
      .getState()
      .drawerGrid.columns.flat()
      .find((panel) => panel.kind === 'terminal');
    if (terminal === undefined) {
      throw new Error('terminal is in the grid');
    }
    store.getState().closeDrawerEntry({ entry: terminal });
    const before = store.getState().drawerGrid;

    store.getState().turnDockPair({ entry: terminal });

    expect(store.getState().drawerGrid).toBe(before);
  });

  it('keeps the height of two stacked panels and goes back to the start on a reset', () => {
    store.getState().openDrawer(TERMINAL);
    store.getState().openDrawer(BROWSER);
    turnShellPair({ key: 'terminal' });

    splitShellColumn({ keys: ['terminal', 'browser'], share: 0.7234 });
    expect(store.getState().drawerGrid.splits).toEqual({ 'terminal/browser': 0.723 });

    splitShellColumn({ keys: ['terminal', 'browser'], share: null });
    expect(store.getState().drawerGrid.splits).toEqual({});
  });

  it('writes no height for panels that are no longer stacked that way', () => {
    store.getState().openDrawer(TERMINAL);
    store.getState().openDrawer(BROWSER);
    const before = store.getState().drawerGrid;

    splitShellColumn({ keys: ['terminal', 'browser'], share: 0.4 });

    expect(store.getState().drawerGrid).toBe(before);
  });
});
