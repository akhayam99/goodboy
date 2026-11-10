// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { listen } from '@tauri-apps/api/event';
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
import type { BrowserTab } from '../../../../store/slices/browser/types';
import { ToastProvider } from '../../../../shared/components/Toast';
import { browserTabListPref } from '../../browserTabListPref';
import { passkeyBannerText } from '../../passkeyBannerText';
import type { BrowserPasskeyEvent, BrowserTabFacts } from '../../types';
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
const OTHER_SESSION_ID = nextSessionId();
const PAYMENTS_API = buildStoryProject({
  id: nextProjectId(),
  workspaceId: WORKSPACE_ID,
  name: 'payments-api',
  rootPath: '/work/payments-api',
});
const TEXT = passkeyBannerText({ host: 'id.cascadia.dev' });

type RowParams = {
  readonly id: string;
  readonly title: string;
  readonly host: string;
};

type AskParams = {
  readonly tabId: string;
  readonly isAsked: boolean;
  readonly sessionId?: SessionId;
};

let store: StoryStore;

const rowOf = ({ id, title, host }: RowParams): BrowserTab => ({
  id,
  sessionId: SESSION_ID,
  projectId: null,
  url: `https://${host}/signin`,
  title,
  position: 0,
  createdAt: 1,
  updatedAt: 1,
});

const factsOf = ({ id, title, host }: RowParams): BrowserTabFacts => ({
  id: `live-${id}`,
  sessionId: SESSION_ID,
  url: `https://${host}/signin`,
  title,
  state: 'live',
  isShown: false,
  hiddenSinceMs: null,
  openerId: null,
});

const SIGN_IN = { id: 'signin', title: 'Sign in', host: 'id.cascadia.dev' };
const LEDGER = { id: 'ledger', title: 'Ledger', host: 'ledger-core.harborline.dev' };

const tell = ({ tabId, isAsked, sessionId = SESSION_ID }: AskParams) => {
  const handler = vi
    .mocked(listen)
    .mock.calls.filter(([name]) => name === 'browser://passkey')
    .map(([, callback]) => callback)
    .at(-1);
  if (handler === undefined) {
    throw new Error('Nothing listens to browser://passkey.');
  }
  const payload: BrowserPasskeyEvent = {
    tabId,
    sessionId,
    host: isAsked ? 'id.cascadia.dev' : '',
    isAsked,
  };
  act(() => {
    handler({ event: 'browser://passkey', id: 1, payload });
  });
};

const renderPane = async () => {
  render(
    <ToastProvider>
      <BrowserPane sessionId={SESSION_ID} onClose={() => undefined} />
    </ToastProvider>,
  );
  await waitFor(() =>
    expect(vi.mocked(listen).mock.calls.some(([name]) => name === 'browser://passkey')).toBe(true),
  );
  await act(async () => undefined);
};

const bannerOf = () => screen.queryByRole('region', { name: TEXT.region });

const openCalls = () =>
  storySpies.tauriInvoke.mock.calls.filter(([name]) => name === 'open_url').map(([, args]) => args);

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: true, value: {} });
  vi.mocked(listen).mockClear();
  await resetStoryStore();
  browserTabListPref.write({ mode: 'list' });
  const tabs = [rowOf(SIGN_IN), rowOf(LEDGER)];
  const live = [factsOf(SIGN_IN), factsOf(LEDGER)];
  store.setState({
    currentWorkspaceId: WORKSPACE_ID,
    projects: [PAYMENTS_API],
    sessions: [buildStorySession({ id: SESSION_ID, workspaceId: WORKSPACE_ID })],
    sessionProjectMounts: {
      [SESSION_ID]: [mountFixture({ sessionId: SESSION_ID, projectId: PAYMENTS_API.id })],
    },
    browserSessionTabs: { [SESSION_ID]: tabs },
    browserActiveTab: { [SESSION_ID]: SIGN_IN.id },
    browserLiveTabs: { [SESSION_ID]: { signin: 'live-signin', ledger: 'live-ledger' } },
  });
  stubStoryInvoke({
    browser_tab_rows_list: () => tabs,
    browser_tab_list: () => live,
    browser_tab_place: null,
    browser_tab_show: null,
    browser_tab_hide: null,
    browser_tab_close: null,
    browser_tab_row_delete: null,
    open_url: null,
  });
});

afterEach(() => {
  cleanup();
  browserTabListPref.clear();
  Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
});

describe('the passkey hand-over banner', () => {
  it('says passkeys do not work above the tab that asked, and only above that tab', async () => {
    await renderPane();
    expect(bannerOf()).toBeNull();

    tell({ tabId: 'live-signin', isAsked: true });

    const banner = await screen.findByRole('region', { name: TEXT.region });
    within(banner).getByText(TEXT.title);
    within(banner).getByText(TEXT.body);
    within(banner).getByRole('button', { name: TEXT.open });
    within(banner).getByRole('button', { name: TEXT.dismiss });

    fireEvent.click(screen.getByRole('button', { name: LEDGER.title }));
    await waitFor(() => expect(bannerOf()).toBeNull());

    fireEvent.click(screen.getByRole('button', { name: SIGN_IN.title }));
    await screen.findByRole('region', { name: TEXT.region });
  });

  it('hands the page to your browser through the address row path', async () => {
    await renderPane();
    tell({ tabId: 'live-signin', isAsked: true });

    const banner = await screen.findByRole('region', { name: TEXT.region });
    fireEvent.click(within(banner).getByRole('button', { name: TEXT.open }));

    await waitFor(() => expect(openCalls()).toEqual([{ url: 'https://id.cascadia.dev/signin' }]));
  });

  it('keeps a dismissed banner away until the next load asks again', async () => {
    await renderPane();
    tell({ tabId: 'live-signin', isAsked: true });

    const banner = await screen.findByRole('region', { name: TEXT.region });
    fireEvent.click(within(banner).getByRole('button', { name: TEXT.dismiss }));
    await waitFor(() => expect(bannerOf()).toBeNull());

    tell({ tabId: 'live-signin', isAsked: false });
    expect(store.getState().browserPasskeyAsks[SESSION_ID]).toEqual({});
    expect(bannerOf()).toBeNull();

    tell({ tabId: 'live-signin', isAsked: true });
    await screen.findByRole('region', { name: TEXT.region });
  });

  it('clears the banner when the next load starts', async () => {
    await renderPane();
    tell({ tabId: 'live-signin', isAsked: true });
    await screen.findByRole('region', { name: TEXT.region });

    tell({ tabId: 'live-signin', isAsked: false });

    await waitFor(() => expect(bannerOf()).toBeNull());
  });

  it('drops an ask for a tab it does not hold or from another session', async () => {
    await renderPane();

    tell({ tabId: 'live-closed', isAsked: true });
    tell({ tabId: 'live-signin', isAsked: true, sessionId: OTHER_SESSION_ID });

    expect(store.getState().browserPasskeyAsks).toEqual({});
    expect(bannerOf()).toBeNull();
  });

  it('forgets the ask when its tab closes', async () => {
    await renderPane();
    tell({ tabId: 'live-signin', isAsked: true });
    await screen.findByRole('region', { name: TEXT.region });

    fireEvent.click(screen.getByRole('button', { name: `Close ${SIGN_IN.title}` }));

    await waitFor(() => expect(store.getState().browserPasskeyAsks[SESSION_ID]).toEqual({}));
    tell({ tabId: 'live-signin', isAsked: true });
    expect(store.getState().browserPasskeyAsks[SESSION_ID]).toEqual({});
  });
});
