// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { nextSessionId, nextWorkspaceId } from '@goodboy/types/testing';
import {
  buildStorySession,
  importStore,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../../../store/storyHarness';
import type { BrowserTab } from '../../../../store/slices/browser/types';
import { ToastProvider } from '../../../../shared/components/Toast';
import type { BrowserTabFacts, BrowserTabState } from '../../types';
import { BrowserPane } from './index';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

const WORKSPACE_ID = nextWorkspaceId();
const SESSION_ID = nextSessionId();
const LIVE_ID = 'live-ledger-core';
const URL = 'http://localhost:4010/ledger';
const VIEW_RECT = { x: 480, y: 96, width: 640, height: 720 };
const NOTE = 'The page closed while you were away. It reloads at its address.';

type StateParams = {
  readonly state: BrowserTabState;
};

let store: StoryStore;
let state: BrowserTabState;
let isListFailing: boolean;

const ROW: BrowserTab = {
  id: 'row-ledger-core',
  sessionId: SESSION_ID,
  projectId: null,
  url: URL,
  title: 'Ledger',
  position: 0,
  createdAt: 1,
  updatedAt: 1,
};

const OTHER_ROW: BrowserTab = {
  ...ROW,
  id: 'row-notify-relay',
  url: 'http://localhost:4020/relay',
  title: 'Relay',
  position: 1,
};

const factsOf = ({ state: tabState }: StateParams): BrowserTabFacts => ({
  id: LIVE_ID,
  sessionId: SESSION_ID,
  url: URL,
  title: 'Ledger',
  state: tabState,
  isShown: false,
  hiddenSinceMs: tabState === 'live' ? null : 1,
  openerId: null,
  isPasskeyBlocked: false,
});

const shows = () =>
  storySpies.tauriInvoke.mock.calls.filter(([name]) => name === 'browser_tab_show').length;

const placeView = async () => {
  const view = await waitFor(() => {
    const found = document.querySelector('[data-browser-view]');
    if (found === null) {
      throw new Error('The pane draws no view placeholder yet.');
    }
    return found;
  });
  Object.defineProperty(view, 'getBoundingClientRect', {
    configurable: true,
    value: () => new DOMRect(VIEW_RECT.x, VIEW_RECT.y, VIEW_RECT.width, VIEW_RECT.height),
  });
  Object.defineProperty(view, 'checkVisibility', { configurable: true, value: () => true });
};

const renderPane = () =>
  render(
    <ToastProvider>
      <BrowserPane sessionId={SESSION_ID} onClose={() => undefined} />
    </ToastProvider>,
  );

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  state = 'closed';
  isListFailing = false;
  await resetStoryStore();
  store.setState({
    currentWorkspaceId: WORKSPACE_ID,
    sessions: [buildStorySession({ id: SESSION_ID, workspaceId: WORKSPACE_ID })],
    browserSessionTabs: { [SESSION_ID]: [ROW] },
    browserActiveTab: { [SESSION_ID]: ROW.id },
    browserShownPin: { [SESSION_ID]: null },
    browserLiveTabs: { [SESSION_ID]: { [ROW.id]: LIVE_ID } },
  });
  stubStoryInvoke({
    browser_tab_rows_list: () => [ROW],
    browser_workspace_tab_rows_list: () => [ROW],
    browser_tab_list: () => {
      if (isListFailing) {
        throw { kind: 'failed', message: 'host gone' };
      }
      return [factsOf({ state })];
    },
    browser_history_state: null,
    browser_console_read: { doc: null, entries: [], watermark: 0, isHeard: false },
    browser_favicon: null,
    browser_tab_place: null,
    browser_tab_open: () => ({ ...factsOf({ state: 'live' }), id: 'live-notify-relay' }),
    browser_tab_show: () => {
      state = 'live';
      return factsOf({ state });
    },
    browser_tab_hide: () => factsOf({ state }),
  });
});

afterEach(() => {
  cleanup();
});

describe('a Browser that comes back after its page closed', () => {
  it('says the page is asleep and reloads, and shows nothing until Wake', async () => {
    renderPane();

    await screen.findByText('localhost:4010 · asleep');
    screen.getByText(NOTE);
    expect(shows()).toBe(0);

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Wake' }));
    });
    await placeView();

    await waitFor(() => expect(shows()).toBe(1));
    expect(screen.queryByText(NOTE)).toBeNull();
  });

  it('shows a page that is only hidden as it was, with no card', async () => {
    state = 'asleep';
    renderPane();
    await placeView();

    await waitFor(() => expect(shows()).toBe(1));
    expect(screen.queryByText(NOTE)).toBeNull();
  });

  it('drops a late answer about a tab that is no longer shown', async () => {
    let answer: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      answer = resolve;
    });
    const handler = storySpies.tauriInvoke.getMockImplementation();
    storySpies.tauriInvoke.mockImplementation(async (name?: unknown, args?: unknown) => {
      if (name === 'browser_tab_list') {
        await held;
      }
      return handler?.(name, args);
    });
    renderPane();

    act(() => {
      store.setState({
        browserSessionTabs: { [SESSION_ID]: [ROW, OTHER_ROW] },
        browserActiveTab: { [SESSION_ID]: OTHER_ROW.id },
      });
    });
    await placeView();
    await waitFor(() => expect(shows()).toBe(1));
    await act(async () => {
      answer();
    });

    expect(screen.queryByRole('button', { name: 'Wake' })).toBeNull();
  });

  it('checks a closed tab picked after the pane opened, and shows nothing until Wake', async () => {
    store.setState({
      browserSessionTabs: { [SESSION_ID]: [ROW, OTHER_ROW] },
      browserActiveTab: { [SESSION_ID]: OTHER_ROW.id },
    });
    renderPane();
    await act(async () => undefined);

    act(() => {
      store.setState({ browserActiveTab: { [SESSION_ID]: ROW.id } });
    });

    await screen.findByText('localhost:4010 · asleep');
    expect(shows()).toBe(0);
  });

  it('checks a page bound after the pane opened before it is shown', async () => {
    store.setState({ browserLiveTabs: { [SESSION_ID]: {} } });
    renderPane();

    act(() => {
      store.setState({ browserLiveTabs: { [SESSION_ID]: { [ROW.id]: LIVE_ID } } });
    });

    await screen.findByText('localhost:4010 · asleep');
    expect(shows()).toBe(0);
  });

  it('shows the page when the engine cannot be asked', async () => {
    isListFailing = true;
    renderPane();
    await placeView();

    await waitFor(() => expect(shows()).toBe(1));
    expect(screen.queryByRole('button', { name: 'Wake' })).toBeNull();
  });
});
