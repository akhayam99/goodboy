// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionId } from '@goodboy/types';
import { nextSessionId } from '@goodboy/types/testing';
import { STORE_IMPORT_TIMEOUT_MS, importStore, resetStoryStore } from '../../store/storyHarness';
import type { StoryStore } from '../../store/storyHarness';
import { terminalOwnerKey, sessionTerminalOwner } from '../../store/slices/terminal/terminalOwner';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);

import { openBranchBrowser } from '../browser/openBranchBrowser';
import { openBranchTerminal } from './openBranchTerminal';

const SESSION_ID: SessionId = nextSessionId();
const HARBORLINE = '/work/harborline/ledger-core';
const NORTHWIND = '/work/northwind/payments-api';

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  store.setState({ currentSessionId: SESSION_ID });
});

const tabsOf = () =>
  store.getState().terminalTabs[
    terminalOwnerKey({ owner: sessionTerminalOwner({ sessionId: SESSION_ID }) })
  ] ?? [];

describe('openBranchTerminal', () => {
  it('opens one tab in that branch folder and points the pill at it', () => {
    openBranchTerminal({ sessionId: SESSION_ID, mountPath: HARBORLINE });

    expect(tabsOf().map((tab) => tab.cwd)).toEqual([HARBORLINE]);
    expect(store.getState().terminalScopes[SESSION_ID]).toBe(HARBORLINE);
    expect(store.getState().drawer?.kind).toBe('terminal');
  });

  it('opens the tab once: pressing again shows the same tab', () => {
    openBranchTerminal({ sessionId: SESSION_ID, mountPath: HARBORLINE });
    openBranchTerminal({ sessionId: SESSION_ID, mountPath: HARBORLINE });

    expect(tabsOf()).toHaveLength(1);
  });

  it('keeps a tab in its folder for life when another branch is asked for', () => {
    openBranchTerminal({ sessionId: SESSION_ID, mountPath: HARBORLINE });
    openBranchTerminal({ sessionId: SESSION_ID, mountPath: NORTHWIND });

    expect(tabsOf().map((tab) => tab.cwd)).toEqual([HARBORLINE, NORTHWIND]);
    expect(store.getState().terminalScopes[SESSION_ID]).toBe(NORTHWIND);
  });
});

describe('openBranchBrowser', () => {
  it('opens the panel for the session and leaves the terminal tabs alone', () => {
    openBranchBrowser({ sessionId: SESSION_ID });

    expect(store.getState().drawer).toMatchObject({ kind: 'browser', sessionId: SESSION_ID });
    expect(tabsOf()).toHaveLength(0);
  });
});
