// @vitest-environment happy-dom
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
} from '../../../../store/storyHarness';
import { mountFixture } from '../../../../__tests__/helpers/actionFixtures';
import type { BrowserTab, TabOwner } from '../../../../store/slices/browser/types';
import { ToastProvider } from '../../../../shared/components/Toast';
import { installFakeResizeObserver } from '../../../../test/fakeResizeObserver';
import type { BrowserTabFacts } from '../../types';
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
const PAYMENTS_API = buildStoryProject({
  id: nextProjectId(),
  workspaceId: WORKSPACE_ID,
  name: 'payments-api',
  rootPath: '/work/payments-api',
});
const VIEW_RECT = { x: 480, y: 96, width: 640, height: 720 };
const MAC_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)';

type OpenArgs = { readonly args: { readonly sessionId: SessionId; readonly url: string } };
type TabArgs = { readonly args: { readonly tabId: string } };
type SaveArgs = {
  readonly args: {
    readonly id: string;
    readonly owner: TabOwner;
    readonly url: string;
    readonly title: string;
  };
};
type OwnerArgs = { readonly args: { readonly owner: TabOwner } };
type LabelParams = { readonly label: string };
type CommandParams = { readonly command: string };
type FailParams = { readonly command: string; readonly reason: string };

let store: StoryStore;
let saved: BrowserTab[];
let live: BrowserTabFacts[];

const savedRow = ({ args }: SaveArgs): BrowserTab => ({
  id: args.id,
  sessionId: args.owner.kind === 'session' ? args.owner.sessionId : null,
  projectId: null,
  url: args.url,
  title: args.title,
  position: saved.length,
  createdAt: 1,
  updatedAt: 1,
});

const liveFacts = ({ args }: OpenArgs): BrowserTabFacts => {
  const facts: BrowserTabFacts = {
    id: `live-${live.length + 1}`,
    sessionId: args.sessionId,
    url: args.url,
    title: '',
    state: 'live',
    isShown: false,
    hiddenSinceMs: null,
    openerId: null,
    isPasskeyBlocked: false,
  };
  live = [...live, facts];
  return facts;
};

const stubDevices = () => {
  stubStoryInvoke({
    browser_tab_rows_list: ({ args }: OwnerArgs) =>
      saved.filter(
        (row) => args.owner.kind === 'session' && row.sessionId === args.owner.sessionId,
      ),
    browser_workspace_tab_rows_list: () => saved,
    browser_tab_row_save: ({ args }: SaveArgs) => {
      const row = savedRow({ args });
      saved = [...saved.filter((existing) => existing.id !== row.id), row];
      return row;
    },
    browser_tab_open: ({ args }: OpenArgs) => liveFacts({ args }),
    browser_tab_list: () => live,
    browser_history_state: null,
    browser_favicon: null,
    browser_tab_place: null,
    browser_tab_show: ({ args }: TabArgs) => live.find((facts) => facts.id === args.tabId),
    browser_tab_hide: ({ args }: TabArgs) => live.find((facts) => facts.id === args.tabId),
    browser_user_agent: null,
  });
};

const callsOf = ({ command }: CommandParams) =>
  storySpies.tauriInvoke.mock.calls
    .filter(([name]) => name === command)
    .map(([, payload]) => {
      const args: unknown =
        typeof payload === 'object' && payload !== null ? Reflect.get(payload, 'args') : null;
      return typeof args === 'object' && args !== null
        ? Object.fromEntries(Object.entries(args))
        : {};
    });

const failCommand = ({ command, reason }: FailParams) => {
  const handler = storySpies.tauriInvoke.getMockImplementation();
  storySpies.tauriInvoke.mockImplementation(async (name?: unknown, args?: unknown) => {
    if (name === command) {
      throw { kind: 'refused', message: reason };
    }
    return handler?.(name, args);
  });
};

const holdFirstAgent = () => {
  const handler = storySpies.tauriInvoke.getMockImplementation();
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let isHeld = false;
  storySpies.tauriInvoke.mockImplementation(async (name?: unknown, args?: unknown) => {
    if (name === 'browser_user_agent' && !isHeld) {
      isHeld = true;
      await gate;
    }
    return handler?.(name, args);
  });
  return { release: () => release() };
};

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

const openCheckout = async () => {
  render(
    <ToastProvider>
      <BrowserPane sessionId={SESSION_ID} onClose={() => undefined} />
    </ToastProvider>,
  );
  const field =
    screen.queryByRole('combobox', { name: 'Address or search' }) ??
    (fireEvent.click(screen.getByRole('button', { name: /^Edit address/ })),
    screen.getByRole('combobox', { name: 'Address or search' }));
  fireEvent.change(field, { target: { value: 'localhost:5173/checkout' } });
  const form = field.closest('form');
  if (form === null) {
    throw new Error('The address field sits in no form.');
  }
  await act(async () => {
    fireEvent.submit(form);
  });
  await placeView();
  await waitFor(() => expect(callsOf({ command: 'browser_tab_show' })).toHaveLength(1));
};

const chooseWidth = async ({ label }: LabelParams) => {
  fireEvent.click(screen.getByRole('button', { name: 'More' }));
  fireEvent.click(await screen.findByRole('menuitem', { name: /^Develop/ }));
  fireEvent.click(await screen.findByRole('menuitem', { name: label }));
};

const deviceFrame = () => document.querySelector('[data-device-frame]');

const asMac = () => {
  const agent = vi.spyOn(window.navigator, 'userAgent', 'get');
  agent.mockReturnValue(MAC_AGENT);
  return agent;
};

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  saved = [];
  live = [];
  installFakeResizeObserver();
  await resetStoryStore();
  store.setState({
    currentWorkspaceId: WORKSPACE_ID,
    projects: [PAYMENTS_API],
    sessions: [buildStorySession({ id: SESSION_ID, workspaceId: WORKSPACE_ID })],
    sessionProjectMounts: {
      [SESSION_ID]: [mountFixture({ sessionId: SESSION_ID, projectId: PAYMENTS_API.id })],
    },
  });
  stubDevices();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the width presets of the browser pane', () => {
  it('frames a narrower page, reports the capped rect and swaps the user agent', async () => {
    asMac();
    await openCheckout();

    await chooseWidth({ label: 'Phone 390' });
    await placeView();

    await waitFor(() =>
      expect(callsOf({ command: 'browser_user_agent' })).toEqual([
        { tabId: 'live-1', preset: 'phone' },
      ]),
    );
    expect((await screen.findByRole('status')).textContent).toBe(
      "Phone 390. Touch isn't simulated.",
    );
    await waitFor(() =>
      expect(callsOf({ command: 'browser_tab_place' }).at(-1)).toEqual({
        tabId: 'live-1',
        bounds: { x: 605, y: 96, width: 390, height: 720 },
      }),
    );
  });

  it('draws the frame around the page and never over it', async () => {
    asMac();
    await openCheckout();

    await chooseWidth({ label: 'Tablet 768' });

    const frame = deviceFrame();
    expect(frame).not.toBeNull();
    expect(frame?.children).toHaveLength(1);
    expect(frame?.firstElementChild).toBe(document.querySelector('[data-browser-view]'));
  });

  it('keeps the width and says the user agent did not change when the host refuses', async () => {
    asMac();
    await openCheckout();
    failCommand({ command: 'browser_user_agent', reason: 'tab-gone' });

    await chooseWidth({ label: 'Phone 390' });

    expect((await screen.findByRole('alert')).textContent).toContain(
      "Couldn't change the user agent of",
    );
    expect((await screen.findByRole('status')).textContent).toBe(
      "Width only, the user agent didn't change",
    );
    expect(deviceFrame()).not.toBeNull();
  });

  it('goes back to Desktop with a second call and no frame', async () => {
    asMac();
    await openCheckout();
    await chooseWidth({ label: 'Phone 390' });
    await waitFor(() => expect(callsOf({ command: 'browser_user_agent' })).toHaveLength(1));

    await chooseWidth({ label: 'Desktop' });

    await waitFor(() =>
      expect(callsOf({ command: 'browser_user_agent' }).at(-1)).toEqual({
        tabId: 'live-1',
        preset: 'desktop',
      }),
    );
    expect(deviceFrame()).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('restores the user agent when Desktop is chosen before the first answer arrives', async () => {
    asMac();
    await openCheckout();
    const held = holdFirstAgent();

    await chooseWidth({ label: 'Phone 390' });
    await waitFor(() => expect(callsOf({ command: 'browser_user_agent' })).toHaveLength(1));
    await chooseWidth({ label: 'Desktop' });
    held.release();

    await waitFor(() =>
      expect(callsOf({ command: 'browser_user_agent' }).map((call) => call.preset)).toEqual([
        'phone',
        'desktop',
      ]),
    );
  });

  it('keeps the preset of a tab across a tab switch and never saves it', async () => {
    asMac();
    await openCheckout();
    await chooseWidth({ label: 'Phone 390' });
    const first = store.getState().browserSessionTabs[SESSION_ID]?.[0];
    if (first === undefined) {
      throw new Error('The pane holds no tab.');
    }
    const savesBefore = callsOf({ command: 'browser_tab_row_save' }).length;

    await act(async () => {
      await store.getState().openBrowserTab({
        sessionId: SESSION_ID,
        tabId: 'row-2',
        url: 'https://acme.example/',
        title: 'Acme',
      });
    });
    await waitFor(() => expect(deviceFrame()).toBeNull());
    act(() => {
      store.getState().activateBrowserTab({ sessionId: SESSION_ID, tabId: first.id });
    });

    await waitFor(() => expect(deviceFrame()).not.toBeNull());
    expect(store.getState().browserDevicePresets).toEqual({ [first.id]: 'phone' });
    expect(callsOf({ command: 'browser_tab_row_save' })).toHaveLength(savesBefore + 1);
  });

  it('keeps the width and skips the host call off macOS', async () => {
    await openCheckout();

    await chooseWidth({ label: 'Tablet 768' });

    expect((await screen.findByRole('status')).textContent).toBe(
      "Width only on this platform. Touch isn't simulated.",
    );
    expect(deviceFrame()).not.toBeNull();
    expect(callsOf({ command: 'browser_user_agent' })).toEqual([]);
  });
});
