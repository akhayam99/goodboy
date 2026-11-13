// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { AgentId, SessionId } from '@goodboy/types';
import { nextAgentId, nextProjectId, nextSessionId, nextWorkspaceId } from '@goodboy/types/testing';
import {
  buildStoryAgent,
  buildStoryProject,
  buildStorySession,
  importStore,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  STORE_IMPORT_TIMEOUT_MS,
  STORY_NOW,
  type StoryStore,
} from '../../../../store/storyHarness';
import { mountFixture } from '../../../../__tests__/helpers/actionFixtures';
import { pressShortcut } from '../../../../__tests__/helpers/pressKey';
import type { BrowserTab, TabOwner } from '../../../../store/slices/browser/types';
import { ToastProvider } from '../../../../shared/components/Toast';
import { pageSendKeyOf } from '../../sendPageToAgent';
import type { BrowserPageText, BrowserTabFacts } from '../../types';
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
const IMPLEMENTER = nextAgentId();
const REVIEWER = nextAgentId();
const PAYMENTS_API = buildStoryProject({
  id: nextProjectId(),
  workspaceId: WORKSPACE_ID,
  name: 'payments-api',
  rootPath: '/work/payments-api',
});

type OpenArgs = {
  readonly args: { readonly sessionId: SessionId; readonly url: string };
};
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
type DeleteArgs = { readonly args: { readonly id: string } };
type TypeParams = { readonly text: string };
type AgentParams = { readonly agentId: AgentId };
type PageTextMode = 'ok' | 'moved' | 'wait';

const CHECKOUT_TEXT = 'Order total 12.00\nRetry the payment';

let store: StoryStore;
let rows: BrowserTab[];
let live: BrowserTabFacts[];
let opened: number;
let mode: PageTextMode;
let release: (() => void) | null;

const rowOf = ({ args }: SaveArgs): BrowserTab => ({
  id: args.id,
  sessionId: args.owner.kind === 'session' ? args.owner.sessionId : null,
  projectId: args.owner.kind === 'project' ? args.owner.projectId : null,
  url: args.url,
  title: args.title,
  position: rows.length,
  createdAt: 1,
  updatedAt: 1,
});

const factsOf = ({ args }: OpenArgs): BrowserTabFacts => {
  opened += 1;
  const facts: BrowserTabFacts = {
    id: `live-${opened}`,
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

const pageOf = ({ args }: TabArgs): BrowserPageText => ({
  title: 'Checkout',
  url: live.find((facts) => facts.id === args.tabId)?.url ?? '',
  text: CHECKOUT_TEXT,
  isCut: false,
});

const pageText = async ({ args }: TabArgs): Promise<BrowserPageText> => {
  if (mode === 'moved') {
    throw { kind: 'refused', message: 'host-unknown' };
  }
  if (mode === 'wait') {
    await new Promise<void>((resolve) => {
      release = resolve;
    });
  }
  return pageOf({ args });
};

const stubHost = () => {
  stubStoryInvoke({
    browser_tab_rows_list: ({ args }: OwnerArgs) =>
      rows.filter((row) =>
        args.owner.kind === 'session'
          ? row.sessionId === args.owner.sessionId
          : row.projectId === args.owner.projectId,
      ),
    browser_workspace_tab_rows_list: () => rows,
    browser_tab_row_save: ({ args }: SaveArgs) => {
      const row = rowOf({ args });
      rows = [...rows.filter((existing) => existing.id !== row.id), row];
      return row;
    },
    browser_tab_row_delete: ({ args }: DeleteArgs) => {
      rows = rows.filter((row) => row.id !== args.id);
      return null;
    },
    browser_tab_open: ({ args }: OpenArgs) => factsOf({ args }),
    browser_tab_list: () => live,
    browser_history_state: null,
    browser_favicon: null,
    browser_tab_place: null,
    browser_tab_show: ({ args }: TabArgs) => live.find((facts) => facts.id === args.tabId),
    browser_tab_hide: ({ args }: TabArgs) => live.find((facts) => facts.id === args.tabId),
    browser_tab_navigate: null,
    browser_tab_reload: null,
    browser_page_text: pageText,
  });
};

const pageTextCalls = () =>
  storySpies.tauriInvoke.mock.calls
    .filter(([name]) => name === 'browser_page_text')
    .map(([, payload]) => payload);

const typeAddress = async ({ text }: TypeParams) => {
  const field = await screen.findByRole('combobox', { name: 'Address or search' });
  fireEvent.change(field, { target: { value: text } });
  const form = field.closest('form');
  if (form === null) {
    throw new Error('The address field sits in no form.');
  }
  await act(async () => {
    fireEvent.submit(form);
  });
};

const tabIds = () => store.getState().browserSessionTabs[SESSION_ID]?.map((tab) => tab.id);

const queued = ({ agentId }: AgentParams) => store.getState().outputHandoffs[agentId] ?? [];

const openCheckout = async () => {
  render(
    <ToastProvider>
      <BrowserPane sessionId={SESSION_ID} onClose={() => undefined} />
    </ToastProvider>,
  );
  await typeAddress({ text: 'localhost:5173/checkout' });
  await waitFor(() => expect(tabIds()).toEqual(['live-1']));
};

const openBilling = async () => {
  await act(async () => {
    pressShortcut({ id: 'browser.newTab' });
  });
  await typeAddress({ text: 'harborline.dev/billing' });
  await waitFor(() => expect(tabIds()).toEqual(['live-1', 'live-2']));
};

const sendByKey = async () => {
  await act(async () => {
    pressShortcut({ id: 'browser.sendToAgent' });
  });
};

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  rows = [];
  live = [];
  opened = 0;
  mode = 'ok';
  release = null;
  await resetStoryStore();
  store.setState({
    currentWorkspaceId: WORKSPACE_ID,
    projects: [PAYMENTS_API],
    sessions: [buildStorySession({ id: SESSION_ID, workspaceId: WORKSPACE_ID })],
    currentSessionId: SESSION_ID,
    sessionPhaseRuns: {
      [SESSION_ID]: [
        buildStoryAgent({ id: IMPLEMENTER, sessionId: SESSION_ID, name: 'Implementer' }),
        buildStoryAgent({ id: REVIEWER, sessionId: SESSION_ID, name: 'Reviewer' }),
      ],
    },
    selectedAgentId: { [SESSION_ID]: IMPLEMENTER },
    sessionProjectMounts: {
      [SESSION_ID]: [mountFixture({ sessionId: SESSION_ID, projectId: PAYMENTS_API.id })],
    },
  });
  store.getState().openDrawer({ kind: 'browser', sessionId: SESSION_ID, payload: null });
  stubHost();
});

afterEach(() => {
  cleanup();
});

describe('send the page to the agent', () => {
  it('reads the shown tab on the key and queues a markdown chip for the agent the composer targets', async () => {
    await openCheckout();

    await sendByKey();

    await waitFor(() => expect(queued({ agentId: IMPLEMENTER })).toHaveLength(1));
    expect(pageTextCalls()).toEqual([
      { args: { tabId: 'live-1', sessionId: SESSION_ID, host: 'localhost' } },
    ]);
    const [handoff] = queued({ agentId: IMPLEMENTER });
    expect(handoff?.fileName).toBe('Checkout.md');
    expect(handoff?.mimeType).toBe('text/markdown');
    expect(handoff?.text.split('\n')[0]).toBe('http://localhost:5173/checkout');
    expect(handoff?.source).toEqual(
      expect.objectContaining({
        kind: 'page',
        title: 'Checkout',
        host: 'localhost:5173',
        wordCount: 6,
      }),
    );
    expect(queued({ agentId: REVIEWER })).toEqual([]);
    expect(storySpies.tauriInvoke.mock.calls.map(([name]) => name)).not.toContain('turn_send');
  });

  it('sends nothing until the key or a row is chosen', async () => {
    await openCheckout();

    expect(pageTextCalls()).toEqual([]);
    expect(queued({ agentId: IMPLEMENTER })).toEqual([]);
  });

  it('names the agent the composer would send to in the More menu and queues for it', async () => {
    store.setState({ selectedAgentId: { [SESSION_ID]: REVIEWER } });
    await openCheckout();

    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    const row = await screen.findByRole('menuitem', { name: /Send to Reviewer/ });
    await act(async () => {
      fireEvent.click(row);
    });

    await waitFor(() => expect(queued({ agentId: REVIEWER })).toHaveLength(1));
    expect(queued({ agentId: IMPLEMENTER })).toEqual([]);
  });

  it('sends the tab of a row from its menu, not the shown one', async () => {
    await openCheckout();
    await openBilling();
    fireEvent.click(screen.getByRole('button', { name: 'Show tab list' }));

    const list = screen.getByRole('navigation', { name: 'Browser tabs' });
    fireEvent.contextMenu(within(list).getByText('localhost:5173'));
    const row = await screen.findByRole('menuitem', { name: /Send to Implementer/ });
    await act(async () => {
      fireEvent.click(row);
    });

    await waitFor(() => expect(queued({ agentId: IMPLEMENTER })).toHaveLength(1));
    expect(pageTextCalls()).toEqual([
      { args: { tabId: 'live-1', sessionId: SESSION_ID, host: 'localhost' } },
    ]);
  });

  it('reads once while a read is out and dims the menu row', async () => {
    mode = 'wait';
    await openCheckout();

    await sendByKey();
    await sendByKey();

    expect(pageTextCalls()).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    const row = await screen.findByRole('menuitem', { name: /Reading the page/ });
    expect(row.getAttribute('aria-disabled')).toBe('true');
    await act(async () => {
      release?.();
    });
    await waitFor(() => expect(queued({ agentId: IMPLEMENTER })).toHaveLength(1));
  });

  it('drops a late answer once the run was cleared', async () => {
    mode = 'wait';
    await openCheckout();
    await sendByKey();

    act(() => {
      store.getState().dropActionRun({ key: pageSendKeyOf({ sessionId: SESSION_ID }) });
    });
    await act(async () => {
      release?.();
    });

    expect(queued({ agentId: IMPLEMENTER })).toEqual([]);
  });

  it('shows the reason on the run line, queues nothing and sends again on Retry', async () => {
    mode = 'moved';
    await openCheckout();

    await sendByKey();

    const failure = await screen.findByRole('alert');
    expect(failure.textContent).toContain("Couldn't send the page");
    expect(failure.textContent).toContain('The page moved to another site. Send it again.');
    expect(queued({ agentId: IMPLEMENTER })).toEqual([]);

    mode = 'ok';
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    });

    await waitFor(() => expect(queued({ agentId: IMPLEMENTER })).toHaveLength(1));
    expect(pageTextCalls()).toHaveLength(2);
    expect(screen.queryByText("Couldn't send the page")).toBeNull();
  });

  it('turns the row off when the session has no live agent', async () => {
    store.setState({
      sessions: [
        buildStorySession({ id: SESSION_ID, workspaceId: WORKSPACE_ID, archivedAt: STORY_NOW }),
      ],
    });
    await openCheckout();

    await sendByKey();
    fireEvent.click(screen.getByRole('button', { name: 'More' }));

    expect(pageTextCalls()).toEqual([]);
    const row = await screen.findByRole('menuitem', { name: /Send to/ });
    expect(row.getAttribute('aria-disabled')).toBe('true');
  });
});
