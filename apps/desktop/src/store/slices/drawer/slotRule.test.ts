// @vitest-environment happy-dom

import { brandId } from '@goodboy/types';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ArtifactId, SessionId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import type { TerminalTabId } from '../../../shared/types/terminal';
import { importStore, resetStoryStore, type StoryStore } from '../../storyHarness';
import { selectOpenDrawer } from './selectOpenDrawer';
import { selectSlotBack } from './selectSlotBack';
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

const EXPLORE: DrawerRequest = { kind: 'explore', sessionId: SESSION_ID, payload: null };

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
    back: selectSlotBack({ state })?.kind ?? null,
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

  it('keeps what the latest open replaced in the chip', () => {
    store.getState().openDrawer(TERMINAL);
    store.getState().openDrawer(PLAN);

    expect(slot()).toEqual({ top: 'artifact-document', back: 'terminal' });
  });

  it('swaps the chip and the slot when the chip is opened', () => {
    store.getState().openDrawer(TERMINAL);
    store.getState().openDrawer(PLAN);

    store.getState().openDrawer(TERMINAL);

    expect(store.getState().drawer).toEqual(TERMINAL);
    expect(store.getState().drawerBack).toEqual(PLAN);
  });

  it('brings the chip back on close, then empties the slot', () => {
    store.getState().openDrawer(TERMINAL);
    store.getState().openDrawer(PLAN);

    store.getState().closeDrawer();
    expect(slot()).toEqual({ top: 'terminal', back: null });

    store.getState().closeDrawer();
    expect(slot()).toEqual({ top: null, back: null });
  });

  it('empties the slot and its chip in one step when the work moved elsewhere', () => {
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

  it('drops the oldest on a third open', () => {
    store.getState().openDrawer(TERMINAL);
    store.getState().openDrawer(EXPLORE);
    store.getState().openDrawer(PLAN);

    expect(store.getState().drawerBack).toEqual(EXPLORE);
    store.getState().closeDrawer();
    store.getState().closeDrawer();
    expect(store.getState().drawer).toBeNull();
  });

  it('keeps the chip when the drawer in the slot opens again', () => {
    store.getState().openDrawer(TERMINAL);
    store.getState().openDrawer(PLAN);
    store.getState().openDrawer({ ...PLAN });

    expect(slot()).toEqual({ top: 'artifact-document', back: 'terminal' });
  });

  it('brings the chip back when its trigger closes the slot', () => {
    store.getState().openDrawer(TERMINAL);
    store.getState().toggleDrawer(PLAN);

    store.getState().toggleDrawer(PLAN);

    expect(slot()).toEqual({ top: 'terminal', back: null });
  });

  it('never chips an artifact drawer when it only changes tab', () => {
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

    expect(slot()).toEqual({ top: 'artifact', back: 'terminal' });
  });

  it('brings the chip back when the artifact drawer loses its artifact', () => {
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

  it('keeps the chip when another session changes its artifact focus', () => {
    const report = brandId<ArtifactId>({ value: 'report-1' });
    store.getState().setFocusedArtifactId(SESSION_ID, report);
    store.getState().openDrawer({
      kind: 'artifact',
      sessionId: SESSION_ID,
      payload: { artifactId: report, tab: 'details' },
    });
    store.getState().openDrawer(TERMINAL);

    store.getState().setFocusedArtifactId(OTHER_SESSION_ID, null);

    expect(slot()).toEqual({ top: 'terminal', back: 'artifact' });
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

  it('never chips a session drawer of another session', () => {
    store.getState().openDrawer(PLAN);
    store.getState().openDrawer({ ...EXPLORE, sessionId: OTHER_SESSION_ID });

    expect(store.getState().drawerBack).toBeNull();
  });

  it('chips Terminal over a tool of another session, a workspace tool has no session to leave', () => {
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

  it('keeps another tool in the chip when a second terminal replaces the first', () => {
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
    expect(slot()).toEqual({ top: 'artifact-document', back: 'terminal' });
  });
});
