import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextSessionId, nextWorkspaceId } from '@goodboy/types/testing';
import { STORE_IMPORT_TIMEOUT_MS, importStore, resetStoryStore } from '../../store/storyHarness';
import type { StoryStore } from '../../store/storyHarness';

type Deferred = {
  readonly promise: Promise<string>;
  readonly resolve: (value: string) => void;
};

const homeGate: { pending: Deferred | null } = vi.hoisted(() => ({ pending: null }));

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@tauri-apps/api/path', () => ({
  homeDir: () => homeGate.pending?.promise ?? Promise.resolve('/Users/mock'),
}));

const WORKSPACE_ID = nextWorkspaceId();
const FIRST_SESSION = nextSessionId();
const SECOND_SESSION = nextSessionId();

let useAppStore: StoryStore;

const holdHome = (): Deferred => {
  let resolve: (value: string) => void = () => undefined;
  const promise = new Promise<string>((done) => {
    resolve = done;
  });
  const deferred = { promise, resolve };
  homeGate.pending = deferred;
  return deferred;
};

const terminalStudioCount = (): number =>
  Object.values(useAppStore.getState().terminalTabs).reduce((sum, tabs) => sum + tabs.length, 0);

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  homeGate.pending = null;
  await resetStoryStore();
  useAppStore.setState({ currentWorkspaceId: WORKSPACE_ID, currentSessionId: FIRST_SESSION });
});

describe('openWorkspaceTerminal', () => {
  it('opens a terminal for the workspace and the session it started from', async () => {
    const { openWorkspaceTerminal } = await import('./openWorkspaceTerminal');

    await openWorkspaceTerminal({ workspaceId: WORKSPACE_ID, isFresh: false });

    expect(terminalStudioCount()).toBe(1);
  });

  it('drops the result when the session changed while the home folder was pending', async () => {
    const { openWorkspaceTerminal } = await import('./openWorkspaceTerminal');
    const gate = holdHome();
    const pending = openWorkspaceTerminal({ workspaceId: WORKSPACE_ID, isFresh: false });

    useAppStore.setState({ currentSessionId: SECOND_SESSION });
    gate.resolve('/Users/mock');
    await pending;

    expect(terminalStudioCount()).toBe(0);
  });

  it('drops the result when the workspace changed while the home folder was pending', async () => {
    const { openWorkspaceTerminal } = await import('./openWorkspaceTerminal');
    const gate = holdHome();
    const pending = openWorkspaceTerminal({ workspaceId: WORKSPACE_ID, isFresh: false });

    useAppStore.setState({ currentWorkspaceId: nextWorkspaceId() });
    gate.resolve('/Users/mock');
    await pending;

    expect(terminalStudioCount()).toBe(0);
  });

  it('drops the result when Browser opened while the home folder was pending', async () => {
    const { openWorkspaceTerminal } = await import('./openWorkspaceTerminal');
    useAppStore.setState({ currentSessionId: null });
    const gate = holdHome();
    const pending = openWorkspaceTerminal({ workspaceId: WORKSPACE_ID, isFresh: false });

    useAppStore.getState().openDrawer({ kind: 'browser', sessionId: null, payload: null });
    gate.resolve('/Users/mock');
    await pending;

    expect(terminalStudioCount()).toBe(0);
    expect(useAppStore.getState().drawer?.kind).toBe('browser');
  });

  it('shows a new terminal on the Terminal page when it opens there', async () => {
    const { openWorkspaceTerminal } = await import('./openWorkspaceTerminal');
    useAppStore.setState({ currentSessionId: null });
    useAppStore
      .getState()
      .openStudio({ studio: { kind: 'terminal', terminalId: null, sessionId: null } });

    await openWorkspaceTerminal({ workspaceId: WORKSPACE_ID, isFresh: true });

    const [tab] = Object.values(useAppStore.getState().terminalTabs).flat();
    const studio = useAppStore.getState().appStudio;
    expect(studio?.kind === 'terminal' ? studio.terminalId : null).toBe(tab?.id);
    expect(useAppStore.getState().terminalSelection?.terminalId).toBe(tab?.id);
    expect(useAppStore.getState().drawer).toBeNull();
  });
});
