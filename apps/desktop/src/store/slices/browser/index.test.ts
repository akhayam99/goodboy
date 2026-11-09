import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertWorkspace } from '@goodboy/db';
import type { ProjectId, SessionId } from '@goodboy/types';
import { nextProjectId, nextSessionId, nextWorkspaceId } from '@goodboy/types/testing';
import {
  buildStoryProject,
  buildStorySession,
  buildStoryWorkspace,
  importStore,
  openStorySqlite,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../storyHarness';
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
const SESSION_ID = nextSessionId();
const OTHER_SESSION_ID = nextSessionId();
const PAYMENTS_API = buildStoryProject({
  id: nextProjectId(),
  workspaceId: WORKSPACE_ID,
  name: 'payments-api',
  rootPath: '/work/payments-api',
});
const NORTHWIND_URL = 'https://northwind.example/orders';
const ACME_URL = 'https://acme.example/dashboard';
const CASCADIA_URL = 'https://cascadia.example/reports';

type SaveArgs = {
  readonly args: {
    readonly id: string;
    readonly owner: TabOwner;
    readonly url: string;
    readonly title: string;
  };
};
type OwnerArgs = { readonly args: { readonly owner: TabOwner } };
type ReorderArgs = { readonly args: { readonly owner: TabOwner; readonly ids: string[] } };
type DeleteArgs = { readonly args: { readonly owner: TabOwner; readonly id: string } };
type MoveArgs = {
  readonly args: {
    readonly id: string;
    readonly sessionId: SessionId;
    readonly projectId: ProjectId;
  };
};
type SessionArgs = { readonly args: { readonly sessionId: SessionId } };

let useAppStore: StoryStore;
let hostRows: BrowserTab[];

const ownedBy = ({ owner, row }: { readonly owner: TabOwner; readonly row: BrowserTab }) =>
  owner.kind === 'session' ? row.sessionId === owner.sessionId : row.projectId === owner.projectId;

const rowsOfOwner = ({ owner }: { readonly owner: TabOwner }) =>
  hostRows.filter((row) => ownedBy({ owner, row })).sort((a, b) => a.position - b.position);

const nextPosition = ({ owner }: { readonly owner: TabOwner }) =>
  rowsOfOwner({ owner }).length === 0
    ? 0
    : Math.max(...rowsOfOwner({ owner }).map((row) => row.position)) + 1;

const stubHost = () => {
  stubStoryInvoke({
    browser_tab_rows_list: ({ args }: OwnerArgs) => rowsOfOwner({ owner: args.owner }),
    browser_tab_row_save: ({ args }: SaveArgs) => {
      const row: BrowserTab = {
        id: args.id,
        sessionId: args.owner.kind === 'session' ? args.owner.sessionId : null,
        projectId: args.owner.kind === 'project' ? args.owner.projectId : null,
        url: args.url,
        title: args.title,
        position: nextPosition({ owner: args.owner }),
        createdAt: 1,
        updatedAt: 1,
      };
      hostRows = [...hostRows.filter((existing) => existing.id !== args.id), row];
      return row;
    },
    browser_tab_rows_reorder: ({ args }: ReorderArgs) => {
      hostRows = hostRows.map((row) =>
        ownedBy({ owner: args.owner, row }) ? { ...row, position: args.ids.indexOf(row.id) } : row,
      );
      return rowsOfOwner({ owner: args.owner });
    },
    browser_tab_row_delete: ({ args }: DeleteArgs) => {
      hostRows = hostRows.filter((row) => row.id !== args.id);
      return null;
    },
    browser_session_tab_rows_delete: ({ args }: SessionArgs) => {
      const before = hostRows.length;
      hostRows = hostRows.filter((row) => row.sessionId !== args.sessionId);
      return before - hostRows.length;
    },
    browser_tab_row_pin: ({ args }: MoveArgs) => {
      const owner: TabOwner = { kind: 'project', projectId: args.projectId };
      const pinned = hostRows.find((row) => row.id === args.id);
      if (pinned === undefined) {
        throw { kind: 'refused', message: 'tab-row-gone' };
      }
      const moved = {
        ...pinned,
        sessionId: null,
        projectId: args.projectId,
        position: nextPosition({ owner }),
      };
      hostRows = hostRows.map((row) => (row.id === args.id ? moved : row));
      return moved;
    },
    browser_tab_row_unpin: ({ args }: MoveArgs) => {
      const owner: TabOwner = { kind: 'session', sessionId: args.sessionId };
      const pinned = hostRows.find((row) => row.id === args.id);
      if (pinned === undefined) {
        throw { kind: 'refused', message: 'tab-row-gone' };
      }
      const moved = {
        ...pinned,
        sessionId: args.sessionId,
        projectId: null,
        position: nextPosition({ owner }),
      };
      hostRows = hostRows.map((row) => (row.id === args.id ? moved : row));
      return moved;
    },
    browser_session_close: { closed: 0, failed: [] },
  });
};

const failCommand = ({ command }: { readonly command: string }) => {
  const handler = storySpies.tauriInvoke.getMockImplementation();
  storySpies.tauriInvoke.mockImplementation(async (name?: unknown, args?: unknown) => {
    if (name === command) {
      throw { kind: 'failed', message: 'tab-rows-failed' };
    }
    return handler?.(name, args);
  });
};

const answerCommand = ({
  command,
  answer,
}: {
  readonly command: string;
  readonly answer: () => unknown;
}) => {
  const handler = storySpies.tauriInvoke.getMockImplementation();
  storySpies.tauriInvoke.mockImplementation(async (name?: unknown, args?: unknown) =>
    name === command ? answer() : handler?.(name, args),
  );
};

const storedErrors = async () =>
  useAppStore
    .getState()
    .notifications.filter((notification) => notification.kind === 'error')
    .map((notification) => ({ title: notification.title }));

const tabIds = ({ sessionId = SESSION_ID }: { readonly sessionId?: SessionId } = {}) =>
  (useAppStore.getState().browserSessionTabs[sessionId] ?? []).map((tab) => tab.id);

const pinIds = () =>
  (useAppStore.getState().browserProjectPins[PAYMENTS_API.id] ?? []).map((tab) => tab.id);

const activeTab = () => useAppStore.getState().browserActiveTab[SESSION_ID];

const openThree = async () => {
  const { openBrowserTab } = useAppStore.getState();
  await openBrowserTab({
    sessionId: SESSION_ID,
    tabId: 'tab-a',
    url: NORTHWIND_URL,
    title: 'Orders',
  });
  await openBrowserTab({
    sessionId: SESSION_ID,
    tabId: 'tab-b',
    url: ACME_URL,
    title: 'Dashboard',
  });
  await openBrowserTab({
    sessionId: SESSION_ID,
    tabId: 'tab-c',
    url: CASCADIA_URL,
    title: 'Reports',
  });
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  hostRows = [];
  await resetStoryStore();
  const db = await openStorySqlite();
  await insertWorkspace({
    db,
    workspace: buildStoryWorkspace({ id: WORKSPACE_ID, name: 'Harborline' }),
  });
  useAppStore.setState({
    currentWorkspaceId: WORKSPACE_ID,
    projects: [PAYMENTS_API],
    sessions: [buildStorySession({ id: SESSION_ID, workspaceId: WORKSPACE_ID })],
  });
  stubHost();
});

describe('browser tabs open, close and reorder', () => {
  it('opens a tab after the host saved it and makes it the active one', async () => {
    const isOk = await useAppStore.getState().openBrowserTab({
      sessionId: SESSION_ID,
      tabId: 'tab-a',
      url: NORTHWIND_URL,
      title: 'Orders',
    });

    expect(isOk).toBe(true);
    expect(tabIds()).toEqual(['tab-a']);
    expect(activeTab()).toBe('tab-a');
    expect(useAppStore.getState().browserSessionTabs[SESSION_ID]?.[0]?.url).toBe(NORTHWIND_URL);
  });

  it('keeps the tabs of another session apart', async () => {
    await openThree();
    await useAppStore.getState().openBrowserTab({
      sessionId: OTHER_SESSION_ID,
      tabId: 'tab-z',
      url: ACME_URL,
      title: 'Dashboard',
    });

    expect(tabIds()).toEqual(['tab-a', 'tab-b', 'tab-c']);
    expect(tabIds({ sessionId: OTHER_SESSION_ID })).toEqual(['tab-z']);
  });

  it('closing the active tab moves the active one to its neighbour', async () => {
    await openThree();
    useAppStore.getState().activateBrowserTab({ sessionId: SESSION_ID, tabId: 'tab-b' });

    await useAppStore.getState().closeBrowserTab({ sessionId: SESSION_ID, tabId: 'tab-b' });

    expect(tabIds()).toEqual(['tab-a', 'tab-c']);
    expect(activeTab()).toBe('tab-c');
    expect(hostRows.map((row) => row.id)).toEqual(['tab-a', 'tab-c']);
  });

  it('closing the last tab leaves no active tab', async () => {
    await useAppStore.getState().openBrowserTab({
      sessionId: SESSION_ID,
      tabId: 'tab-a',
      url: NORTHWIND_URL,
      title: 'Orders',
    });

    await useAppStore.getState().closeBrowserTab({ sessionId: SESSION_ID, tabId: 'tab-a' });

    expect(tabIds()).toEqual([]);
    expect(activeTab()).toBeNull();
  });

  it('reorders to the order the host answered with', async () => {
    await openThree();

    await useAppStore
      .getState()
      .reorderBrowserTabs({ sessionId: SESSION_ID, ids: ['tab-c', 'tab-a', 'tab-b'] });

    expect(tabIds()).toEqual(['tab-c', 'tab-a', 'tab-b']);
  });

  it('ignores an activate for a tab the session does not hold', async () => {
    await openThree();

    useAppStore.getState().activateBrowserTab({ sessionId: SESSION_ID, tabId: 'tab-gone' });

    expect(activeTab()).toBe('tab-c');
  });
});

describe('browser tabs pin and unpin', () => {
  it('moves a tab from the session to the project pins', async () => {
    await openThree();

    const isOk = await useAppStore
      .getState()
      .pinBrowserTab({ sessionId: SESSION_ID, projectId: PAYMENTS_API.id, tabId: 'tab-b' });

    expect(isOk).toBe(true);
    expect(tabIds()).toEqual(['tab-a', 'tab-c']);
    expect(pinIds()).toEqual(['tab-b']);
    expect(useAppStore.getState().browserProjectPins[PAYMENTS_API.id]?.[0]?.sessionId).toBeNull();
  });

  it('unpins a tab back into the session and activates it', async () => {
    await openThree();
    await useAppStore
      .getState()
      .pinBrowserTab({ sessionId: SESSION_ID, projectId: PAYMENTS_API.id, tabId: 'tab-b' });

    await useAppStore
      .getState()
      .unpinBrowserTab({ sessionId: SESSION_ID, projectId: PAYMENTS_API.id, tabId: 'tab-b' });

    expect(pinIds()).toEqual([]);
    expect(tabIds()).toEqual(['tab-a', 'tab-c', 'tab-b']);
    expect(activeTab()).toBe('tab-b');
  });

  it('a pin survives the close of its session', async () => {
    await openThree();
    await useAppStore
      .getState()
      .pinBrowserTab({ sessionId: SESSION_ID, projectId: PAYMENTS_API.id, tabId: 'tab-b' });

    await useAppStore.getState().closeBrowserSessionTabs({ sessionId: SESSION_ID });

    expect(hostRows.map((row) => row.id)).toEqual(['tab-b']);
    expect(pinIds()).toEqual(['tab-b']);
    expect(tabIds()).toEqual([]);
  });

  it('a session close forgets its live views and its shown pin', async () => {
    await openThree();
    useAppStore
      .getState()
      .bindBrowserLiveTab({ sessionId: SESSION_ID, tabId: 'tab-a', liveId: 'live-a' });
    useAppStore.setState({ browserShownPin: { [SESSION_ID]: 'pin-guides' } });

    await useAppStore.getState().closeBrowserSessionTabs({ sessionId: SESSION_ID });

    expect(useAppStore.getState().browserLiveTabs[SESSION_ID]).toEqual({});
    expect(useAppStore.getState().browserShownPin[SESSION_ID]).toBeNull();
  });
});

describe('a failed host call keeps the old state and shows the error', () => {
  it('open fails: nothing is added and the error is stored', async () => {
    await openThree();
    failCommand({ command: 'browser_tab_row_save' });

    const isOk = await useAppStore.getState().openBrowserTab({
      sessionId: SESSION_ID,
      tabId: 'tab-d',
      url: NORTHWIND_URL,
      title: 'Orders',
    });

    expect(isOk).toBe(false);
    expect(tabIds()).toEqual(['tab-a', 'tab-b', 'tab-c']);
    expect(activeTab()).toBe('tab-c');
    expect(await storedErrors()).toEqual([{ title: "Couldn't open the tab" }]);
  });

  it('close fails: the tab stays, and a retry closes it', async () => {
    await openThree();
    failCommand({ command: 'browser_tab_row_delete' });

    const wasClosed = await useAppStore
      .getState()
      .closeBrowserTab({ sessionId: SESSION_ID, tabId: 'tab-a' });

    expect(wasClosed).toBe(false);
    expect(tabIds()).toEqual(['tab-a', 'tab-b', 'tab-c']);
    expect(await storedErrors()).toEqual([{ title: "Couldn't close the tab" }]);

    stubHost();
    const wasRetried = await useAppStore
      .getState()
      .closeBrowserTab({ sessionId: SESSION_ID, tabId: 'tab-a' });

    expect(wasRetried).toBe(true);
    expect(tabIds()).toEqual(['tab-b', 'tab-c']);
  });

  it('reorder fails: the old order stays', async () => {
    await openThree();
    failCommand({ command: 'browser_tab_rows_reorder' });

    await useAppStore
      .getState()
      .reorderBrowserTabs({ sessionId: SESSION_ID, ids: ['tab-c', 'tab-b', 'tab-a'] });

    expect(tabIds()).toEqual(['tab-a', 'tab-b', 'tab-c']);
    expect(await storedErrors()).toEqual([{ title: "Couldn't reorder the tabs" }]);
  });

  it('pin fails: the tab stays in the session and no pin appears', async () => {
    await openThree();
    failCommand({ command: 'browser_tab_row_pin' });

    await useAppStore
      .getState()
      .pinBrowserTab({ sessionId: SESSION_ID, projectId: PAYMENTS_API.id, tabId: 'tab-b' });

    expect(tabIds()).toEqual(['tab-a', 'tab-b', 'tab-c']);
    expect(pinIds()).toEqual([]);
    expect(await storedErrors()).toEqual([{ title: "Couldn't pin the tab" }]);
  });

  it('unpin fails: the pin stays', async () => {
    await openThree();
    await useAppStore
      .getState()
      .pinBrowserTab({ sessionId: SESSION_ID, projectId: PAYMENTS_API.id, tabId: 'tab-b' });
    failCommand({ command: 'browser_tab_row_unpin' });

    await useAppStore
      .getState()
      .unpinBrowserTab({ sessionId: SESSION_ID, projectId: PAYMENTS_API.id, tabId: 'tab-b' });

    expect(pinIds()).toEqual(['tab-b']);
    expect(tabIds()).toEqual(['tab-a', 'tab-c']);
    expect(await storedErrors()).toEqual([{ title: "Couldn't unpin the tab" }]);
  });

  it('a failed load keeps what was loaded before', async () => {
    await openThree();
    failCommand({ command: 'browser_tab_rows_list' });

    await useAppStore.getState().loadBrowserSessionTabs({ sessionId: SESSION_ID });

    expect(tabIds()).toEqual(['tab-a', 'tab-b', 'tab-c']);
    expect(await storedErrors()).toEqual([{ title: "Couldn't load the browser tabs" }]);
  });
});

describe('a late answer is dropped', () => {
  it('an older load that answers after a newer one does not overwrite it', async () => {
    const olderRow: BrowserTab = {
      id: 'tab-old',
      sessionId: SESSION_ID,
      projectId: null,
      url: NORTHWIND_URL,
      title: 'Orders',
      position: 0,
      createdAt: 1,
      updatedAt: 1,
    };
    const newerRow: BrowserTab = { ...olderRow, id: 'tab-new' };
    let releaseOlder: (rows: BrowserTab[]) => void = () => undefined;
    let isFirst = true;
    stubStoryInvoke({
      browser_tab_rows_list: () => {
        if (isFirst) {
          isFirst = false;
          return new Promise<BrowserTab[]>((resolve) => {
            releaseOlder = resolve;
          });
        }
        return [newerRow];
      },
    });

    const older = useAppStore.getState().loadBrowserSessionTabs({ sessionId: SESSION_ID });
    await useAppStore.getState().loadBrowserSessionTabs({ sessionId: SESSION_ID });
    releaseOlder([olderRow]);
    await older;

    expect(tabIds()).toEqual(['tab-new']);
  });

  it('a load that was in flight when a tab opened does not erase the tab', async () => {
    let releaseLoad: (rows: BrowserTab[]) => void = () => undefined;
    let isFirst = true;
    answerCommand({
      command: 'browser_tab_rows_list',
      answer: () => {
        if (isFirst) {
          isFirst = false;
          return new Promise<BrowserTab[]>((resolve) => {
            releaseLoad = resolve;
          });
        }
        return rowsOfOwner({ owner: { kind: 'session', sessionId: SESSION_ID } });
      },
    });

    const load = useAppStore.getState().loadBrowserSessionTabs({ sessionId: SESSION_ID });
    await useAppStore.getState().openBrowserTab({
      sessionId: SESSION_ID,
      tabId: 'tab-a',
      url: NORTHWIND_URL,
      title: 'Orders',
    });
    releaseLoad([]);
    await load;

    expect(tabIds()).toEqual(['tab-a']);
  });

  it('two quick reorders land in call order, so the last one wins', async () => {
    await openThree();

    const first = useAppStore
      .getState()
      .reorderBrowserTabs({ sessionId: SESSION_ID, ids: ['tab-b', 'tab-a', 'tab-c'] });
    const second = useAppStore
      .getState()
      .reorderBrowserTabs({ sessionId: SESSION_ID, ids: ['tab-c', 'tab-b', 'tab-a'] });
    await Promise.all([first, second]);

    expect(tabIds()).toEqual(['tab-c', 'tab-b', 'tab-a']);
  });

  it('an address save queued behind a close does not bring the row back', async () => {
    await openThree();

    const closed = useAppStore
      .getState()
      .closeBrowserTab({ sessionId: SESSION_ID, tabId: 'tab-b' });
    const saved = useAppStore.getState().updateBrowserTab({
      sessionId: SESSION_ID,
      tabId: 'tab-b',
      url: ACME_URL,
      title: 'Acme',
    });
    await Promise.all([closed, saved]);

    expect(await saved).toBe(false);
    expect(tabIds()).toEqual(['tab-a', 'tab-c']);
    expect(hostRows.map((row) => row.id)).toEqual(['tab-a', 'tab-c']);
  });
});

describe('a second window sees the same rows', () => {
  it('loads the session tabs and the project pins another window wrote', async () => {
    await openThree();
    await useAppStore
      .getState()
      .pinBrowserTab({ sessionId: SESSION_ID, projectId: PAYMENTS_API.id, tabId: 'tab-b' });
    const written = {
      tabs: useAppStore.getState().browserSessionTabs[SESSION_ID],
      pins: useAppStore.getState().browserProjectPins[PAYMENTS_API.id],
    };

    useAppStore.setState({ browserSessionTabs: {}, browserProjectPins: {}, browserActiveTab: {} });
    await useAppStore.getState().loadBrowserSessionTabs({ sessionId: SESSION_ID });
    await useAppStore.getState().loadBrowserProjectPins({ projectId: PAYMENTS_API.id });

    expect(useAppStore.getState().browserSessionTabs[SESSION_ID]).toEqual(written.tabs);
    expect(useAppStore.getState().browserProjectPins[PAYMENTS_API.id]).toEqual(written.pins);
    expect(activeTab()).toBe('tab-a');
  });
});

describe('closing a session closes its live tabs and deletes its rows', () => {
  it('closes the live tabs, then deletes the rows, then clears the state', async () => {
    await openThree();

    await useAppStore.getState().closeBrowserSessionTabs({ sessionId: SESSION_ID });

    const commands = storySpies.tauriInvoke.mock.calls
      .map(([name]) => String(name))
      .filter(
        (name) => name === 'browser_session_close' || name === 'browser_session_tab_rows_delete',
      );
    expect(commands).toEqual(['browser_session_close', 'browser_session_tab_rows_delete']);
    expect(hostRows).toEqual([]);
    expect(tabIds()).toEqual([]);
    expect(activeTab()).toBeNull();
  });

  it('a tab that did not close keeps its rows, shows the error, and never throws', async () => {
    await openThree();
    answerCommand({
      command: 'browser_session_close',
      answer: () => ({ closed: 2, failed: [{ tabId: 'tab-b', reason: 'tab-gone' }] }),
    });

    await expect(
      useAppStore.getState().closeBrowserSessionTabs({ sessionId: SESSION_ID }),
    ).resolves.toBeUndefined();

    expect(hostRows).toHaveLength(3);
    expect(tabIds()).toEqual(['tab-a', 'tab-b', 'tab-c']);
    expect(await storedErrors()).toEqual([{ title: "Couldn't close the browser tabs" }]);
  });

  it('a retry after a partial close finishes the job', async () => {
    await openThree();
    let isFirst = true;
    answerCommand({
      command: 'browser_session_close',
      answer: () => {
        if (isFirst) {
          isFirst = false;
          return { closed: 2, failed: [{ tabId: 'tab-b', reason: 'tab-gone' }] };
        }
        return { closed: 1, failed: [] };
      },
    });

    await useAppStore.getState().closeBrowserSessionTabs({ sessionId: SESSION_ID });
    await useAppStore.getState().closeBrowserSessionTabs({ sessionId: SESSION_ID });

    expect(hostRows).toEqual([]);
    expect(tabIds()).toEqual([]);
  });
});
