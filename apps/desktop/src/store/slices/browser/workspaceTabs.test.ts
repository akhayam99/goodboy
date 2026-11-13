import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectId, SessionId, WorkspaceId } from '@goodboy/types';
import { nextProjectId, nextSessionId, nextWorkspaceId } from '@goodboy/types/testing';
import {
  buildStoryProject,
  buildStorySession,
  importStore,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../storyHarness';
import { selectBrowserTabCount } from './selectBrowserTabCount';
import { selectBrowserTabCountState } from './selectBrowserTabCountState';
import type { BrowserTab, TabOwner } from './types';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).sqliteDbLibModuleMock(),
);

const WORKSPACE_ID = nextWorkspaceId();
const ELSEWHERE_ID = nextWorkspaceId();
const CHECKOUT = nextSessionId();
const BILLING = nextSessionId();
const FAR_AWAY = nextSessionId();
const PAYMENTS_API = buildStoryProject({
  id: nextProjectId(),
  workspaceId: WORKSPACE_ID,
  name: 'payments-api',
  rootPath: '/work/payments-api',
});
const NORTHWIND_URL = 'https://northwind.example/orders';

type RowParams = {
  readonly id: string;
  readonly owner: TabOwner;
};
type SaveArgs = {
  readonly args: {
    readonly id: string;
    readonly owner: TabOwner;
    readonly url: string;
    readonly title: string;
  };
};
type DeleteArgs = { readonly args: { readonly id: string } };
type MoveArgs = {
  readonly args: {
    readonly id: string;
    readonly sessionId: SessionId;
    readonly projectId: ProjectId;
  };
};
type WorkspaceParams = { readonly workspaceId: WorkspaceId };

let store: StoryStore;
let hostRows: BrowserTab[];

const rowOf = ({ id, owner }: RowParams): BrowserTab => ({
  id,
  sessionId: owner.kind === 'session' ? owner.sessionId : null,
  projectId: owner.kind === 'project' ? owner.projectId : null,
  url: NORTHWIND_URL,
  title: id,
  position: 0,
  createdAt: 1,
  updatedAt: 1,
});

const stubHost = () => {
  stubStoryInvoke({
    browser_workspace_tab_rows_list: () => hostRows,
    browser_tab_row_save: ({ args }: SaveArgs) => {
      const row = { ...rowOf({ id: args.id, owner: args.owner }), url: args.url };
      hostRows = [...hostRows.filter((existing) => existing.id !== args.id), row];
      return row;
    },
    browser_tab_row_delete: ({ args }: DeleteArgs) => {
      hostRows = hostRows.filter((row) => row.id !== args.id);
      return null;
    },
    browser_tab_row_pin: ({ args }: MoveArgs) => {
      const moved = rowOf({ id: args.id, owner: { kind: 'project', projectId: args.projectId } });
      hostRows = hostRows.map((row) => (row.id === args.id ? moved : row));
      return moved;
    },
    browser_tab_row_unpin: ({ args }: MoveArgs) => {
      const moved = rowOf({ id: args.id, owner: { kind: 'session', sessionId: args.sessionId } });
      hostRows = hostRows.map((row) => (row.id === args.id ? moved : row));
      return moved;
    },
  });
};

const listedLength = ({ workspaceId }: WorkspaceParams): number => {
  const state = store.getState();
  const tabs = state.sessions
    .filter((session) => session.workspaceId === workspaceId)
    .reduce((total, session) => total + (state.browserSessionTabs[session.id]?.length ?? 0), 0);
  return state.projects
    .filter((project) => project.workspaceId === workspaceId)
    .reduce((total, project) => total + (state.browserProjectPins[project.id]?.length ?? 0), tabs);
};

const keptCount = () =>
  selectBrowserTabCount({ state: store.getState(), workspaceId: WORKSPACE_ID });

const workspaceCalls = () =>
  storySpies.tauriInvoke.mock.calls.filter(([name]) => name === 'browser_workspace_tab_rows_list')
    .length;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  hostRows = [
    rowOf({ id: 'tab-a', owner: { kind: 'session', sessionId: CHECKOUT } }),
    rowOf({ id: 'tab-b', owner: { kind: 'session', sessionId: CHECKOUT } }),
    rowOf({ id: 'tab-c', owner: { kind: 'session', sessionId: BILLING } }),
    rowOf({ id: 'pin-a', owner: { kind: 'project', projectId: PAYMENTS_API.id } }),
    rowOf({ id: 'tab-far', owner: { kind: 'session', sessionId: FAR_AWAY } }),
  ];
  store.setState({
    currentWorkspaceId: WORKSPACE_ID,
    projects: [PAYMENTS_API],
    sessions: [
      buildStorySession({ id: CHECKOUT, workspaceId: WORKSPACE_ID }),
      buildStorySession({ id: BILLING, workspaceId: WORKSPACE_ID }),
      buildStorySession({ id: FAR_AWAY, workspaceId: ELSEWHERE_ID }),
    ],
  });
  stubHost();
});

describe('the workspace tab rows', () => {
  it('reports no count until the rows have loaded', () => {
    expect(keptCount()).toBeNull();
  });

  it('loads the tabs and pins of every session of the workspace with one command', async () => {
    await store.getState().loadBrowserWorkspaceTabs({ workspaceId: WORKSPACE_ID });

    expect(workspaceCalls()).toBe(1);
    expect((store.getState().browserSessionTabs[CHECKOUT] ?? []).map((tab) => tab.id)).toEqual([
      'tab-a',
      'tab-b',
    ]);
    expect((store.getState().browserSessionTabs[BILLING] ?? []).map((tab) => tab.id)).toEqual([
      'tab-c',
    ]);
    expect(store.getState().browserSessionTabs[FAR_AWAY]).toBeUndefined();
    expect(keptCount()).toBe(4);
  });

  it('shares one command between callers that ask while it runs', async () => {
    await Promise.all([
      store.getState().loadBrowserWorkspaceTabs({ workspaceId: WORKSPACE_ID }),
      store.getState().loadBrowserWorkspaceTabs({ workspaceId: WORKSPACE_ID }),
    ]);

    expect(workspaceCalls()).toBe(1);
  });

  it('keeps the count equal to the listed tabs after every tab write', async () => {
    await store.getState().loadBrowserWorkspaceTabs({ workspaceId: WORKSPACE_ID });
    expect(keptCount()).toBe(listedLength({ workspaceId: WORKSPACE_ID }));

    await store.getState().openBrowserTab({
      sessionId: BILLING,
      tabId: 'tab-d',
      url: NORTHWIND_URL,
      title: 'Orders',
    });
    expect(keptCount()).toBe(5);
    expect(keptCount()).toBe(listedLength({ workspaceId: WORKSPACE_ID }));

    await store.getState().pinBrowserTab({
      sessionId: BILLING,
      tabId: 'tab-d',
      projectId: PAYMENTS_API.id,
    });
    expect(keptCount()).toBe(5);
    expect(keptCount()).toBe(listedLength({ workspaceId: WORKSPACE_ID }));

    await store.getState().unpinBrowserTab({
      sessionId: BILLING,
      tabId: 'tab-d',
      projectId: PAYMENTS_API.id,
    });
    expect(keptCount()).toBe(listedLength({ workspaceId: WORKSPACE_ID }));

    await store.getState().closeBrowserTab({ sessionId: CHECKOUT, tabId: 'tab-a' });
    expect(keptCount()).toBe(4);
    expect(keptCount()).toBe(listedLength({ workspaceId: WORKSPACE_ID }));

    await store.getState().closeBrowserSessionTabs({ sessionId: CHECKOUT });
    expect(keptCount()).toBe(listedLength({ workspaceId: WORKSPACE_ID }));
  });

  it('keeps the count when an archived session drops its tabs', async () => {
    await store.getState().loadBrowserWorkspaceTabs({ workspaceId: WORKSPACE_ID });

    store.getState().evictSession({ sessionId: CHECKOUT, mode: 'archive' });

    expect(keptCount()).toBe(listedLength({ workspaceId: WORKSPACE_ID }));
    expect(keptCount()).toBe(2);
  });

  it('keeps a tab written while the rows were loading', async () => {
    let release: (rows: BrowserTab[]) => void = () => undefined;
    const answer = new Promise<BrowserTab[]>((resolve) => {
      release = resolve;
    });
    const handler = storySpies.tauriInvoke.getMockImplementation();
    storySpies.tauriInvoke.mockImplementation(async (name?: unknown, args?: unknown) =>
      name === 'browser_workspace_tab_rows_list' ? answer : handler?.(name, args),
    );

    const loading = store.getState().loadBrowserWorkspaceTabs({ workspaceId: WORKSPACE_ID });
    await store.getState().openBrowserTab({
      sessionId: BILLING,
      tabId: 'tab-new',
      url: NORTHWIND_URL,
      title: 'Orders',
    });
    release([]);
    await loading;

    expect((store.getState().browserSessionTabs[BILLING] ?? []).map((tab) => tab.id)).toEqual([
      'tab-new',
    ]);
    expect((store.getState().browserSessionTabs[CHECKOUT] ?? []).length).toBe(0);
    expect(keptCount()).toBe(listedLength({ workspaceId: WORKSPACE_ID }));
  });

  it('leaves the old tabs and says so when the rows cannot load', async () => {
    await store.getState().loadBrowserWorkspaceTabs({ workspaceId: WORKSPACE_ID });
    const handler = storySpies.tauriInvoke.getMockImplementation();
    storySpies.tauriInvoke.mockImplementation(async (name?: unknown, args?: unknown) => {
      if (name === 'browser_workspace_tab_rows_list') {
        throw { kind: 'failed', message: 'tab-rows-failed' };
      }
      return handler?.(name, args);
    });

    await store.getState().loadBrowserWorkspaceTabs({ workspaceId: WORKSPACE_ID });

    expect(keptCount()).toBe(4);
    expect(
      store
        .getState()
        .notifications.filter((notification) => notification.kind === 'error')
        .map((notification) => notification.title),
    ).toEqual(["Couldn't load the browser tabs"]);
  });

  it('marks the count failed when the first load fails and ready after a retry', async () => {
    const handler = storySpies.tauriInvoke.getMockImplementation();
    storySpies.tauriInvoke.mockImplementation(async (name?: unknown, args?: unknown) => {
      if (name === 'browser_workspace_tab_rows_list') {
        throw { kind: 'failed', message: 'tab-rows-failed' };
      }
      return handler?.(name, args);
    });
    const stateOf = () =>
      selectBrowserTabCountState({ state: store.getState(), workspaceId: WORKSPACE_ID });
    expect(stateOf()).toBe('loading');

    await store.getState().loadBrowserWorkspaceTabs({ workspaceId: WORKSPACE_ID });

    expect(keptCount()).toBeNull();
    expect(stateOf()).toBe('failed');

    storySpies.tauriInvoke.mockImplementation(async (name?: unknown, args?: unknown) =>
      handler?.(name, args),
    );
    await store.getState().loadBrowserWorkspaceTabs({ workspaceId: WORKSPACE_ID });

    expect(stateOf()).toBe('ready');
    expect(store.getState().browserTabCountFailures).toEqual({});
  });
});
