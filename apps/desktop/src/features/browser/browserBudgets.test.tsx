// @vitest-environment happy-dom
import { readFileSync } from 'fs';
import { join } from 'path';
import { Profiler } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';
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
} from '../../store/storyHarness';
import { mountFixture } from '../../__tests__/helpers/actionFixtures';
import type { BrowserTab, TabOwner } from '../../store/slices/browser/types';
import { ToastProvider } from '../../shared/components/Toast';
import { DrawerHost } from '../../app/components/DrawerHost';
import { BROWSER_BUDGETS } from './browserBudgets';
import { BrowserPane } from './components/BrowserPane';
import type { BrowserTabFacts } from './types';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../shared/lib/db', async () =>
  (await import('../../store/storyHarness')).sqliteDbLibModuleMock(),
);

const WORKSPACE_ID = nextWorkspaceId();
const SESSION_ID = nextSessionId();
const PAYMENTS_API = buildStoryProject({
  id: nextProjectId(),
  workspaceId: WORKSPACE_ID,
  name: 'payments-api',
  rootPath: '/work/payments-api',
});
const FRAMES = 12;

type OpenArgs = { readonly args: { readonly sessionId: SessionId; readonly url: string } };
type SaveArgs = {
  readonly args: {
    readonly id: string;
    readonly owner: TabOwner;
    readonly url: string;
    readonly title: string;
  };
};
type TabArgs = { readonly args: { readonly tabId: string } };
type CommandParams = { readonly command: string };
type TextParams = { readonly text: string };
type RectParams = { readonly element: Element; readonly x: number };
type CountParams = { readonly count: number };

let store: StoryStore;
let rows: BrowserTab[];
let live: BrowserTabFacts[];
let opened: number;
let storeCommits: number;
let reactCommits: number;
let frames: Map<number, FrameRequestCallback>;
let nextFrame: number;

const settle = () => new Promise((resolve) => setImmediate(resolve));

const stubHost = () => {
  stubStoryInvoke({
    browser_tab_rows_list: () => rows,
    browser_tab_row_save: ({ args }: SaveArgs) => {
      const row: BrowserTab = {
        id: args.id,
        sessionId: SESSION_ID,
        projectId: null,
        url: args.url,
        title: args.title,
        position: rows.length,
        createdAt: 1,
        updatedAt: 1,
      };
      rows = [...rows.filter((existing) => existing.id !== row.id), row];
      return row;
    },
    browser_tab_row_delete: ({ args }: { readonly args: { readonly id: string } }) => {
      rows = rows.filter((row) => row.id !== args.id);
      return null;
    },
    browser_tab_open: ({ args }: OpenArgs) => {
      opened += 1;
      const facts: BrowserTabFacts = {
        id: `live-${opened}`,
        sessionId: args.sessionId,
        url: args.url,
        title: '',
        isShown: false,
        hiddenSinceMs: null,
        openerId: null,
        isPasskeyBlocked: false,
      };
      live = [...live, facts];
      return facts;
    },
    browser_tab_list: () => live,
    browser_tab_place: null,
    browser_tab_show: ({ args }: TabArgs) => live.find((facts) => facts.id === args.tabId),
    browser_tab_hide: ({ args }: TabArgs) => live.find((facts) => facts.id === args.tabId),
    browser_tab_close: ({ args }: TabArgs) => {
      live = live.filter((facts) => facts.id !== args.tabId);
      return null;
    },
  });
};

const callsOf = ({ command }: CommandParams): number =>
  storySpies.tauriInvoke.mock.calls.filter(([name]) => name === command).length;

const browserCommands = (): number =>
  storySpies.tauriInvoke.mock.calls.filter(
    ([name]) => typeof name === 'string' && name.startsWith('browser_'),
  ).length;

const giveRect = ({ element, x }: RectParams) => {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => new DOMRect(x, 96, 640, 720),
  });
  Object.defineProperty(element, 'checkVisibility', { configurable: true, value: () => true });
};

const viewElement = async (): Promise<Element> =>
  waitFor(() => {
    const found = document.querySelector('[data-browser-view]');
    if (found === null) {
      throw new Error('The pane draws no view placeholder yet.');
    }
    return found;
  });

const runFrame = async () => {
  const due = Array.from(frames.values());
  frames.clear();
  await act(async () => {
    due.forEach((callback) => callback(0));
    await settle();
  });
};

const renderPane = () =>
  render(
    <ToastProvider>
      <Profiler
        id="pane"
        onRender={() => {
          reactCommits += 1;
        }}
      >
        <BrowserPane sessionId={SESSION_ID} onClose={() => undefined} />
      </Profiler>
    </ToastProvider>,
  );

const openPage = async ({ text }: TextParams) => {
  const field = screen.getByRole('textbox', { name: 'Address' });
  fireEvent.change(field, { target: { value: text } });
  const form = field.closest('form');
  if (form === null) {
    throw new Error('The address field sits in no form.');
  }
  await act(async () => {
    fireEvent.submit(form);
  });
  const view = await viewElement();
  giveRect({ element: view, x: 480 });
  await runFrame();
  await waitFor(() => expect(callsOf({ command: 'browser_tab_show' })).toBeGreaterThan(0));
  await runFrame();
  return view;
};

const startCounting = () => {
  storeCommits = 0;
  reactCommits = 0;
};

const idle = async ({ count }: CountParams) => {
  for (let step = 0; step < count; step += 1) {
    await settle();
  }
};

beforeAll(async () => {
  store = await importStore();
  store.subscribe(() => {
    storeCommits += 1;
  });
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  rows = [];
  live = [];
  opened = 0;
  storeCommits = 0;
  reactCommits = 0;
  frames = new Map();
  nextFrame = 0;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    nextFrame += 1;
    frames.set(nextFrame, callback);
    return nextFrame;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    frames.delete(id);
  });
  await resetStoryStore();
  store.setState({
    currentWorkspaceId: WORKSPACE_ID,
    projects: [PAYMENTS_API],
    sessions: [buildStorySession({ id: SESSION_ID, workspaceId: WORKSPACE_ID })],
    sessionProjectMounts: {
      [SESSION_ID]: [mountFixture({ sessionId: SESSION_ID, projectId: PAYMENTS_API.id })],
    },
  });
  stubHost();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the browser stays inside its budget', () => {
  it('runs no host command and no frame while no tab has been opened', async () => {
    render(
      <ToastProvider>
        <DrawerHost />
      </ToastProvider>,
    );
    startCounting();

    await idle({ count: 10 });

    expect(browserCommands()).toBe(BROWSER_BUDGETS.hostCommandsBeforeFirstTab);
    expect(frames.size).toBe(BROWSER_BUDGETS.frameRequestsBeforeFirstTab);
    expect(storeCommits).toBe(0);
  });

  it('commits the store a fixed number of times to open, switch and close a tab', async () => {
    renderPane();

    startCounting();
    await openPage({ text: 'localhost:5173/checkout' });
    expect(storeCommits).toBe(BROWSER_BUDGETS.storeCommitsPerOpen);

    fireEvent.click(screen.getByRole('button', { name: 'New tab' }));
    await openPage({ text: 'harborline.dev/billing' });
    startCounting();
    fireEvent.click(screen.getByRole('button', { name: 'localhost:5173' }));
    await runFrame();
    expect(storeCommits).toBe(BROWSER_BUDGETS.storeCommitsPerSwitch);

    startCounting();
    fireEvent.click(screen.getByRole('button', { name: 'Close localhost:5173' }));
    await waitFor(() => expect(callsOf({ command: 'browser_tab_close' })).toBe(1));
    await runFrame();
    expect(storeCommits).toBe(BROWSER_BUDGETS.storeCommitsPerClose);
  });

  it('moves the view with one host call a frame and commits nothing in React or the store', async () => {
    renderPane();
    const view = await openPage({ text: 'localhost:5173/checkout' });
    const placedBefore = callsOf({ command: 'browser_tab_place' });
    startCounting();

    for (let frame = 1; frame <= FRAMES; frame += 1) {
      giveRect({ element: view, x: 480 + frame });
      await runFrame();
    }

    const placed = callsOf({ command: 'browser_tab_place' }) - placedBefore;
    expect(placed).toBeLessThanOrEqual(FRAMES * BROWSER_BUDGETS.hostCallsPerPlacementFrame);
    expect(placed).toBeGreaterThan(0);
    expect(reactCommits).toBe(BROWSER_BUDGETS.reactCommitsPerPlacementFrame);
    expect(storeCommits).toBe(BROWSER_BUDGETS.storeCommitsPerPlacementFrame);
  });

  it('makes no host call for a frame where the view has not moved', async () => {
    renderPane();
    await openPage({ text: 'localhost:5173/checkout' });
    const commandsBefore = browserCommands();
    startCounting();

    for (let frame = 0; frame < FRAMES; frame += 1) {
      await runFrame();
    }

    expect(browserCommands() - commandsBefore).toBe(
      FRAMES * BROWSER_BUDGETS.hostCallsPerStillFrame,
    );
    expect(reactCommits).toBe(BROWSER_BUDGETS.reactCommitsPerPlacementFrame);
    expect(storeCommits).toBe(BROWSER_BUDGETS.storeCommitsPerPlacementFrame);
  });

  it('names the manual memory gate numbers in docs/testing.md', () => {
    const doc = readFileSync(join(__dirname, '../../../../../docs/testing.md'), 'utf8').replace(
      /\s+/g,
      ' ',
    );
    const { memoryMbPerLiveTab } = BROWSER_BUDGETS;

    expect(doc).toContain(`under ${BROWSER_BUDGETS.memoryMbOverNoTabsWithFourTabs} MB`);
    expect(doc).toContain(`${memoryMbPerLiveTab.low} to ${memoryMbPerLiveTab.high} MB`);
    expect(doc).toContain(`stays at ${BROWSER_BUDGETS.liveTabsPerWindow}`);
    expect(doc).toContain(`${BROWSER_BUDGETS.minutesHiddenBeforeClose} minutes`);
    expect(doc).toContain(`within ${BROWSER_BUDGETS.scrollP95WithinPercent} percent`);
  });
});
