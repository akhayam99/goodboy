// @vitest-environment happy-dom

import { brandId } from '@goodboy/types';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ArtifactId, SessionId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import type { TerminalTabId } from '../../../shared/types/terminal';
import { importStore, resetStoryStore, type StoryStore } from '../../storyHarness';
import { selectOpenDrawer } from './selectOpenDrawer';
import { selectDetailDrawer } from './selectDetailDrawer';
import { selectDockDrawer } from './selectDockDrawer';
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

const EXPLORE: DrawerRequest = {
  kind: 'conversation',
  sessionId: SESSION_ID,
  payload: { threadId: 'thread-harborline' },
};

const PLAN: DrawerRequest = {
  kind: 'artifact-document',
  sessionId: SESSION_ID,
  payload: { artifactId: brandId<ArtifactId>({ value: 'plan-1' }), revision: null },
};

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
});

const slot = () => {
  const state = store.getState();
  return {
    top: selectOpenDrawer(state)?.kind ?? null,
    back: state.drawerBack?.kind ?? null,
  };
};

const panels = () => {
  const state = store.getState();
  return {
    dock: selectDockDrawer({ state })?.kind ?? null,
    detail: selectDetailDrawer({ state })?.kind ?? null,
  };
};

describe('the side slot', () => {
  beforeEach(async () => {
    await resetStoryStore();
    store.setState({
      sessions: [aSession({ id: SESSION_ID }), aSession({ id: OTHER_SESSION_ID })],
      currentSessionId: SESSION_ID,
    });
  });

  it('keeps no history of a reader the latest open replaced', () => {
    store.getState().openDrawer(EXPLORE);
    store.getState().openDrawer(PLAN);

    expect(slot()).toEqual({ top: 'artifact-document', back: null });
  });

  it('shows a detail panel and the tool dock together, with no chip between them', () => {
    store.getState().openDrawer(TERMINAL);
    store.getState().openDrawer(PLAN);

    expect(panels()).toEqual({ dock: 'terminal', detail: 'artifact-document' });
  });

  it('replaces only the detail when another detail opens beside the dock', () => {
    store.getState().openDrawer(TERMINAL);
    store.getState().openDrawer(PLAN);
    store.getState().openDrawer(EXPLORE);

    expect(panels()).toEqual({ dock: 'terminal', detail: 'conversation' });
  });

  it('closes each panel on its own: the dock X leaves the detail, the detail X leaves the dock', () => {
    store.getState().openDrawer(TERMINAL);
    store.getState().openDrawer(PLAN);
    const dock = selectDockDrawer({ state: store.getState() });
    if (dock === null) {
      throw new Error('the dock is open');
    }

    store.getState().closeDrawerEntry({ entry: dock });
    expect(panels()).toEqual({ dock: null, detail: 'artifact-document' });

    store.getState().openDrawer(TERMINAL);
    const detail = selectDetailDrawer({ state: store.getState() });
    if (detail === null) {
      throw new Error('the detail is open');
    }
    store.getState().closeDrawerEntry({ entry: detail });
    expect(panels()).toEqual({ dock: 'terminal', detail: null });
  });

  it('toggles the dock from the rail without touching the detail', () => {
    store.getState().openDrawer(TERMINAL);
    store.getState().openDrawer(PLAN);

    store.getState().toggleDrawer(TERMINAL);

    expect(panels()).toEqual({ dock: null, detail: 'artifact-document' });
  });

  it('puts a reopened dock tool on top, with the detail beside it', () => {
    store.getState().openDrawer(TERMINAL);
    store.getState().openDrawer(PLAN);

    store.getState().openDrawer(TERMINAL);

    expect(store.getState().drawer).toEqual(TERMINAL);
    expect(store.getState().drawerBack).toEqual(PLAN);
  });

  it('closes the detail, then the dock', () => {
    store.getState().openDrawer(TERMINAL);
    store.getState().openDrawer(PLAN);

    store.getState().closeDrawer();
    expect(slot()).toEqual({ top: 'terminal', back: null });

    store.getState().closeDrawer();
    expect(slot()).toEqual({ top: null, back: null });
  });

  it('empties both panels in one step when the work moved elsewhere', () => {
    store.getState().openDrawer(TERMINAL);
    store.getState().openDrawer(PLAN);

    store.getState().clearDrawer();

    expect(store.getState().drawer).toBeNull();
    expect(store.getState().drawerBack).toBeNull();
  });

  it('leaves an empty slot as it is when cleared', () => {
    const before = store.getState().drawer;

    store.getState().clearDrawer();

    expect(store.getState().drawer).toBe(before);
    expect(store.getState().drawerBack).toBeNull();
  });

  it('keeps nothing behind a third reader', () => {
    store.getState().openDrawer(EXPLORE);
    store.getState().openDrawer(PLAN);
    store.getState().openDrawer({
      kind: 'artifact',
      sessionId: SESSION_ID,
      payload: { artifactId: brandId<ArtifactId>({ value: 'report-1' }), tab: 'details' },
    });

    expect(store.getState().drawerBack).toBeNull();
    store.getState().closeDrawer();
    expect(store.getState().drawer).toBeNull();
  });

  it('keeps the slot as it is when the drawer in the slot opens again', () => {
    store.getState().openDrawer(EXPLORE);
    store.getState().openDrawer(PLAN);
    store.getState().openDrawer({ ...PLAN });

    expect(slot()).toEqual({ top: 'artifact-document', back: null });
  });

  it('leaves the dock when the detail trigger closes it', () => {
    store.getState().openDrawer(TERMINAL);
    store.getState().toggleDrawer(PLAN);

    store.getState().toggleDrawer(PLAN);

    expect(slot()).toEqual({ top: 'terminal', back: null });
  });

  it('keeps one artifact drawer when it only changes tab', () => {
    const report = brandId<ArtifactId>({ value: 'report-1' });
    store.getState().openDrawer(TERMINAL);
    store.getState().openDrawer({
      kind: 'artifact',
      sessionId: SESSION_ID,
      payload: { artifactId: report, tab: 'details' },
    });
    store.getState().openDrawer({
      kind: 'artifact',
      sessionId: SESSION_ID,
      payload: { artifactId: report, tab: 'chat' },
    });

    expect(panels()).toEqual({ dock: 'terminal', detail: 'artifact' });
  });

  it('leaves the dock when the artifact drawer loses its artifact', () => {
    const report = brandId<ArtifactId>({ value: 'report-1' });
    store.getState().setFocusedArtifactId(SESSION_ID, report);
    store.getState().openDrawer(TERMINAL);
    store.getState().openDrawer({
      kind: 'artifact',
      sessionId: SESSION_ID,
      payload: { artifactId: report, tab: 'details' },
    });

    store.getState().setFocusedArtifactId(SESSION_ID, null);

    expect(slot()).toEqual({ top: 'terminal', back: null });
  });

  it('keeps the dock when another session changes its artifact focus', () => {
    const report = brandId<ArtifactId>({ value: 'report-1' });
    store.getState().setFocusedArtifactId(SESSION_ID, report);
    store.getState().openDrawer({
      kind: 'artifact',
      sessionId: SESSION_ID,
      payload: { artifactId: report, tab: 'details' },
    });
    store.getState().openDrawer(TERMINAL);

    store.getState().setFocusedArtifactId(OTHER_SESSION_ID, null);

    expect(panels()).toEqual({ dock: 'terminal', detail: 'artifact' });
  });

  it('keeps the open artifact drawer when another session changes its artifact focus', () => {
    const report = brandId<ArtifactId>({ value: 'report-1' });
    store.getState().setFocusedArtifactId(SESSION_ID, report);
    store.getState().openDrawer({
      kind: 'artifact',
      sessionId: SESSION_ID,
      payload: { artifactId: report, tab: 'details' },
    });

    store.getState().setFocusedArtifactId(OTHER_SESSION_ID, null);

    expect(slot()).toEqual({ top: 'artifact', back: null });
  });

  it('keeps no history of a session drawer of another session', () => {
    store.getState().openDrawer(PLAN);
    store.getState().openDrawer({ ...EXPLORE, sessionId: OTHER_SESSION_ID });

    expect(store.getState().drawerBack).toBeNull();
  });

  it('pairs Terminal with a reader of another session, a workspace tool has no session to leave', () => {
    store.getState().openDrawer(TERMINAL);
    store.getState().openDrawer({ ...EXPLORE, sessionId: OTHER_SESSION_ID });

    expect(store.getState().drawerBack?.kind).toBe('terminal');
  });

  it('replaces Terminal with a second terminal, so hiding Terminal hides the dock', () => {
    const second: DrawerRequest = {
      kind: 'terminal',
      sessionId: null,
      payload: { terminalId: brandId<TerminalTabId>({ value: 'term-2' }) },
    };
    store.getState().openDrawer(TERMINAL);
    store.getState().openDrawer(second);

    expect(store.getState().drawer).toEqual(second);
    expect(store.getState().drawerBack).toBeNull();
    store.getState().closeDrawer();
    expect(store.getState().drawer).toBeNull();
  });

  it('keeps the reader beside the dock when a second terminal replaces the first', () => {
    const second: DrawerRequest = {
      ...TERMINAL,
      payload: { terminalId: brandId<TerminalTabId>({ value: 'term-2' }) },
    };
    store.getState().openDrawer(PLAN);
    store.getState().openDrawer(TERMINAL);
    store.getState().openDrawer(second);

    expect(store.getState().drawer).toEqual(second);
    expect(store.getState().drawerBack).toEqual(PLAN);
  });

  it('gives a second window its own slot', async () => {
    store.getState().openDrawer(TERMINAL);
    store.getState().openDrawer(PLAN);
    vi.resetModules();
    const second = await importStore();

    second.getState().openDrawer(EXPLORE);

    expect(second).not.toBe(store);
    expect(second.getState().drawerBack).toBeNull();
    expect(panels()).toEqual({ dock: 'terminal', detail: 'artifact-document' });
  });
});
