// @vitest-environment happy-dom
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { nextSessionId, nextWorkspaceId } from '@goodboy/types/testing';
import {
  importStore,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../../../store/storyHarness';
import type { BrowserTab, TabOwner } from '../../../../store/slices/browser/types';
import type { BrowserTabFacts } from '../../types';
import { useSaveLiveAddresses } from './index';

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
const CHECKOUT = 'https://northwind.example/checkout';
const BILLING = 'https://northwind.example/billing';

type SaveArgs = {
  readonly args: {
    readonly id: string;
    readonly owner: TabOwner;
    readonly url: string;
    readonly title: string;
  };
};
type FactsParams = { readonly url: string };
type TabParams = { readonly url: string };

let store: StoryStore;

const tabAt = ({ url }: TabParams): BrowserTab => ({
  id: 'tab-1',
  sessionId: SESSION_ID,
  projectId: null,
  url,
  title: 'Checkout',
  position: 0,
  createdAt: 1,
  updatedAt: 1,
});

const factsAt = ({ url }: FactsParams): ReadonlyArray<BrowserTabFacts> => [
  {
    id: 'live-1',
    sessionId: SESSION_ID,
    url,
    title: 'Checkout',
    state: 'live',
    isShown: true,
    hiddenSinceMs: null,
    openerId: null,
  },
];

const saveCalls = () =>
  storySpies.tauriInvoke.mock.calls.filter(([name]) => name === 'browser_tab_row_save');

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({
    browser_tab_row_save: ({ args }: SaveArgs) => tabAt({ url: args.url }),
  });
  store.setState({
    browserSessionTabs: { [SESSION_ID]: [tabAt({ url: CHECKOUT })] },
    browserLiveTabs: { [SESSION_ID]: { 'tab-1': 'live-1' } },
  });
});

describe('saving the live address of a tab', () => {
  it('a second instance with an older snapshot does not write the old address back', async () => {
    const live = { 'tab-1': 'live-1' };
    const first = renderHook((props) => useSaveLiveAddresses(props), {
      initialProps: {
        sessionId: SESSION_ID,
        tabs: [tabAt({ url: CHECKOUT })],
        live,
        facts: factsAt({ url: CHECKOUT }),
      },
    });
    renderHook((props) => useSaveLiveAddresses(props), {
      initialProps: {
        sessionId: SESSION_ID,
        tabs: [tabAt({ url: CHECKOUT })],
        live,
        facts: factsAt({ url: CHECKOUT }),
      },
    });
    const second = renderHook((props) => useSaveLiveAddresses(props), {
      initialProps: {
        sessionId: SESSION_ID,
        tabs: [tabAt({ url: CHECKOUT })],
        live,
        facts: factsAt({ url: CHECKOUT }),
      },
    });

    first.rerender({
      sessionId: SESSION_ID,
      tabs: [tabAt({ url: CHECKOUT })],
      live,
      facts: factsAt({ url: BILLING }),
    });
    await waitFor(() => expect(saveCalls()).toHaveLength(1));
    second.rerender({
      sessionId: SESSION_ID,
      tabs: [tabAt({ url: BILLING })],
      live,
      facts: factsAt({ url: CHECKOUT }),
    });

    expect(saveCalls()).toHaveLength(1);
  });
});
