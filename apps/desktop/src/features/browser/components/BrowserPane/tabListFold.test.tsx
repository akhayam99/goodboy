// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { listen } from '@tauri-apps/api/event';
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
import type { BrowserTab } from '../../../../store/slices/browser/types';
import { ToastProvider } from '../../../../shared/components/Toast';
import { browserTabListPref } from '../../browserTabListPref';
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
const PAYMENTS_API = buildStoryProject({
  id: nextProjectId(),
  workspaceId: WORKSPACE_ID,
  name: 'payments-api',
  rootPath: '/work/payments-api',
});

type TellParams = {
  readonly facts: BrowserTabFacts;
};

type RowParams = {
  readonly id: string;
  readonly title: string;
  readonly isPin: boolean;
};

let store: StoryStore;
let live: BrowserTabFacts[];

const rowOf = ({ id, title, isPin }: RowParams): BrowserTab => ({
  id,
  sessionId: isPin ? null : SESSION_ID,
  projectId: isPin ? PAYMENTS_API.id : null,
  url: `https://${id}.harborline.dev/`,
  title,
  position: 0,
  createdAt: 1,
  updatedAt: 1,
});

const factsOf = ({ id, state }: { readonly id: string; readonly state: BrowserTabState }) => ({
  id: `live-${id}`,
  sessionId: SESSION_ID,
  url: `https://${id}.harborline.dev/`,
  title: '',
  state,
  isShown: false,
  hiddenSinceMs: null,
  isPasskeyBlocked: false,
  openerId: null,
});

const tell = ({ facts }: TellParams) => {
  const handler = vi
    .mocked(listen)
    .mock.calls.filter(([name]) => name === 'browser://tab-state')
    .map(([, callback]) => callback)
    .at(-1);
  if (handler === undefined) {
    throw new Error('Nothing listens to browser://tab-state.');
  }
  act(() => {
    handler({ event: 'browser://tab-state', id: 1, payload: facts });
  });
};

const renderPane = () =>
  render(
    <ToastProvider>
      <BrowserPane sessionId={SESSION_ID} onClose={() => undefined} />
    </ToastProvider>,
  );

const listOf = async () => {
  const pane = await screen.findByRole('region', { name: 'Browser' });
  await waitFor(() =>
    expect(storySpies.tauriInvoke.mock.calls.some(([name]) => name === 'browser_tab_list')).toBe(
      true,
    ),
  );
  await act(async () => undefined);
  return within(pane).getByRole('navigation', { name: 'Browser tabs' });
};

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: true, value: {} });
  await resetStoryStore();
  browserTabListPref.write({ mode: 'list' });
  const tabs = [
    rowOf({ id: 'checkout', title: 'Checkout', isPin: false }),
    rowOf({ id: 'tax', title: 'Tax rates', isPin: false }),
  ];
  const pins = [rowOf({ id: 'staging', title: 'Staging checkout', isPin: true })];
  live = [factsOf({ id: 'checkout', state: 'live' }), factsOf({ id: 'tax', state: 'live' })];
  store.setState({
    currentWorkspaceId: WORKSPACE_ID,
    projects: [PAYMENTS_API],
    sessions: [buildStorySession({ id: SESSION_ID, workspaceId: WORKSPACE_ID })],
    sessionProjectMounts: {
      [SESSION_ID]: [mountFixture({ sessionId: SESSION_ID, projectId: PAYMENTS_API.id })],
    },
    browserSessionTabs: { [SESSION_ID]: tabs },
    browserActiveTab: { [SESSION_ID]: 'checkout' },
    browserProjectPins: { [PAYMENTS_API.id]: pins },
    browserLiveTabs: {
      [SESSION_ID]: { checkout: 'live-checkout', tax: 'live-tax' },
    },
  });
  stubStoryInvoke({
    browser_tab_rows_list: ({ args }: { readonly args: { readonly owner: { kind: string } } }) =>
      args.owner.kind === 'project' ? pins : tabs,
    browser_workspace_tab_rows_list: () => [...tabs, ...pins],
    browser_tab_list: () => live,
    browser_tab_place: null,
    browser_tab_show: null,
    browser_tab_hide: null,
    browser_history_state: null,
    browser_favicon: null,
  });
});

afterEach(() => {
  cleanup();
  browserTabListPref.clear();
  Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
});

describe('the browser tab list', () => {
  it('draws the pins of the project first, then the session, then New tab', async () => {
    renderPane();

    const list = await listOf();
    const names = within(list)
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label') ?? button.textContent)
      .filter((name) => !name?.startsWith('Close '));
    expect(names.slice(0, 4)).toEqual([
      'Staging checkout, pinned',
      'Checkout',
      'Tax rates',
      'New tab',
    ]);
    within(list).getByText('Pinned · payments-api');
    expect(within(list).queryByText('Tabs close when the session is archived.')).toBeNull();
  });

  it('marks a tab asleep when the engine says so and clears it when the tab wakes', async () => {
    renderPane();
    const list = await listOf();
    within(list).getByRole('button', { name: 'Tax rates' });

    tell({ facts: factsOf({ id: 'tax', state: 'asleep' }) });
    await within(list).findByRole('button', { name: 'Tax rates, asleep' });
    within(list).getByRole('button', { name: 'Checkout' });

    tell({ facts: factsOf({ id: 'tax', state: 'live' }) });
    await within(list).findByRole('button', { name: 'Tax rates' });
  });

  it('drops the asleep mark on the next poll when the wake event never came', async () => {
    store.getState().openDrawer({ kind: 'browser', sessionId: SESSION_ID, payload: null });
    renderPane();
    const list = await listOf();

    tell({ facts: factsOf({ id: 'tax', state: 'asleep' }) });
    await within(list).findByRole('button', { name: 'Tax rates, asleep' });

    await within(list).findByRole('button', { name: 'Tax rates' }, { timeout: 4000 });
  }, 8000);

  it('explains the session label in a tooltip the label itself opens', async () => {
    renderPane();
    const list = await listOf();

    fireEvent.mouseEnter(within(list).getByText('This session'));

    expect(await screen.findByText('Tabs close when the session is archived.')).toBeDefined();
  });

  it('folds to a rail and back, and keeps the width for the next time', async () => {
    renderPane();
    const list = await listOf();
    expect(list.getAttribute('data-tab-list')).toBe('list');

    fireEvent.click(within(list).getByRole('button', { name: 'Fold tab list' }));
    await waitFor(() => expect(list.getAttribute('data-tab-list')).toBe('rail'));
    expect(browserTabListPref.read()).toBe('rail');
    expect(within(list).queryByText('Tax rates')).toBeNull();

    fireEvent.click(within(list).getByRole('button', { name: 'Expand tab list' }));
    await waitFor(() => expect(list.getAttribute('data-tab-list')).toBe('list'));
    expect(browserTabListPref.read()).toBe('list');
  });
});
