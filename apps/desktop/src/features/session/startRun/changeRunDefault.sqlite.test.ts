// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSetting, setSetting } from '@goodboy/db';
import { aSession, aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  openStorySqlite,
  resetStoryStore,
  storySqlite,
  type StoryStore,
} from '../../../store/storyHarness';
import { changeRunDefault } from './changeRunDefault';
import { runDefaultKey, type RunDefaultScope } from './runDefaultSetting';
import { runDefaultOf } from './runDefaultOf';

const WORKSPACE = aWorkspace({ name: 'Acme' });
const SESSION = aSession({ workspaceId: WORKSPACE.id, goal: 'Notify relay' });
const SESSION_SCOPE: RunDefaultScope = { kind: 'session', sessionId: SESSION.id };
const WORKSPACE_SCOPE: RunDefaultScope = { kind: 'workspace', workspaceId: WORKSPACE.id };

let useAppStore: StoryStore;

const stored = (scope: RunDefaultScope) => getSetting(storySqlite(), runDefaultKey({ scope }));

const defaultNow = () =>
  runDefaultOf({
    settings: useAppStore.getState().settings,
    workspaceId: WORKSPACE.id,
    sessionId: SESSION.id,
  });

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  await openStorySqlite();
  useAppStore.setState({ workspaces: [WORKSPACE], sessions: [SESSION] });
});

describe('changeRunDefault', () => {
  it('keeps the session default and lets it win over the workspace', async () => {
    await changeRunDefault({ scope: WORKSPACE_SCOPE, shape: 'lead' });
    expect(defaultNow()).toBe('lead');

    await changeRunDefault({ scope: SESSION_SCOPE, shape: 'plan' });

    expect(await stored(SESSION_SCOPE)).toBe('plan');
    expect(defaultNow()).toBe('plan');
  });

  it('undo puts the earlier default back', async () => {
    await changeRunDefault({ scope: SESSION_SCOPE, shape: 'plan' });

    expect(await useAppStore.getState().undoLastOperation()).toBe(true);

    expect(await stored(SESSION_SCOPE)).toBe('auto');
    expect(defaultNow()).toBe('auto');
  });

  it('undo changes nothing when another window changed the default since', async () => {
    await changeRunDefault({ scope: SESSION_SCOPE, shape: 'plan' });
    await setSetting(storySqlite(), runDefaultKey({ scope: SESSION_SCOPE }), 'lead');

    expect(await useAppStore.getState().undoLastOperation()).toBe(false);

    expect(await stored(SESSION_SCOPE)).toBe('lead');
  });

  it('undo that cannot read the default keeps it and reports it', async () => {
    await changeRunDefault({ scope: SESSION_SCOPE, shape: 'plan' });
    const reportError = vi.fn(async () => undefined);
    useAppStore.setState({
      reportError,
      loadSetting: async () => {
        throw new Error('database is locked');
      },
    });

    expect(await useAppStore.getState().undoLastOperation()).toBe(false);

    expect(reportError).toHaveBeenCalled();
    expect(await stored(SESSION_SCOPE)).toBe('plan');
  });

  it('undo whose reload fails still leaves the earlier default written', async () => {
    await changeRunDefault({ scope: SESSION_SCOPE, shape: 'plan' });
    const reportError = vi.fn(async () => undefined);
    const loadSetting = useAppStore.getState().loadSetting;
    let reads = 0;
    useAppStore.setState({
      reportError,
      loadSetting: async (key: string) => {
        reads += 1;
        if (reads > 1) {
          throw new Error('database is locked');
        }
        return loadSetting(key);
      },
    });

    expect(await useAppStore.getState().undoLastOperation()).toBe(false);

    expect(reportError).toHaveBeenCalled();
    expect(await stored(SESSION_SCOPE)).toBe('auto');
  });

  it('writes nothing and offers no undo when the default is already set', async () => {
    await changeRunDefault({ scope: WORKSPACE_SCOPE, shape: 'auto' });

    expect(await stored(WORKSPACE_SCOPE)).toBeNull();
    expect(useAppStore.getState().undoStack).toHaveLength(0);
  });
});
