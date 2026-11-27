// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AgentId, SessionId } from '@goodboy/types';
import { nextAgentId, nextProjectId, nextSessionId, nextWorkspaceId } from '@goodboy/types/testing';
import {
  buildStoryAgent,
  buildStoryProject,
  buildStorySession,
  importStore,
  openStorySqlite,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../../../store/storyHarness';
import { mountFixture } from '../../../../__tests__/helpers/actionFixtures';
import { pressShortcut } from '../../../../__tests__/helpers/pressKey';
import type { BrowserTab, TabOwner } from '../../../../store/slices/browser/types';
import { ToastProvider } from '../../../../shared/components/Toast';
import { ObjectMenuProvider } from '../../../actions/components/ObjectMenuProvider';
import type { BrowserPickedElement, BrowserPickRead, BrowserTabFacts } from '../../types';
import { BrowserStudio } from './index';

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
const CHECKOUT_SESSION = nextSessionId();
const ROUNDING_SESSION = nextSessionId();
const IMPLEMENTER = nextAgentId();
const REVIEWER = nextAgentId();
const PAYMENTS_API = buildStoryProject({
  id: nextProjectId(),
  workspaceId: WORKSPACE_ID,
  name: 'payments-api',
  rootPath: '/work/payments-api',
});
const VIEW_RECT = { x: 320, y: 96, width: 800, height: 720 };
const CROP = 'iVBORw==';
const NOTE = 'Round the total to two decimals';

type RowParams = {
  readonly id: string;
  readonly owner: TabOwner;
  readonly url: string;
  readonly title: string;
  readonly position: number;
};
type OpenArgs = {
  readonly args: { readonly sessionId: SessionId; readonly url: string };
};
type TabArgs = { readonly args: { readonly tabId: string } };
type OwnerArgs = { readonly args: { readonly owner: TabOwner } };
type PickArgs = {
  readonly args: { readonly tabId: string; readonly op: 'start' | 'stop' | 'read' };
};
type PayloadParams = { readonly payload: unknown };
type AgentParams = { readonly agentId: AgentId };
type ClickParams = { readonly elements: ReadonlyArray<BrowserPickedElement> };
type StudioParams = { readonly sessionId: SessionId; readonly tabId: string };
type CropMode = 'ok' | 'wait';

const TOTAL: BrowserPickedElement = {
  tag: 'span',
  label: 'span.total',
  selector: '#root > main > span.total',
  text: '$85.004',
  html: '<span class="total">$85.004</span>',
  isHtmlCut: false,
  styles: [{ name: 'display', value: 'inline' }],
  component: 'LedgerTotal',
  source: { path: '/src/ledger/LedgerTotal.tsx', line: 17 },
  isSourceSettled: true,
  rect: { x: 12, y: 80, width: 64, height: 20 },
  url: 'http://localhost:5174/ledger',
};

let store: StoryStore;
let rows: BrowserTab[];
let live: BrowserTabFacts[];
let opened: number;
let page: BrowserPickRead;
let cropMode: CropMode;
let releaseCrop: (() => void) | null;

const rowOf = ({ id, owner, url, title, position }: RowParams): BrowserTab => ({
  id,
  sessionId: owner.kind === 'session' ? owner.sessionId : null,
  projectId: owner.kind === 'project' ? owner.projectId : null,
  url,
  title,
  position,
  createdAt: 1,
  updatedAt: 1,
});

const factsOf = ({ args }: OpenArgs): BrowserTabFacts => {
  opened += 1;
  const facts: BrowserTabFacts = {
    id: `live-${opened}`,
    sessionId: args.sessionId,
    url: args.url,
    title: 'Ledger',
    state: 'live',
    isShown: false,
    hiddenSinceMs: null,
    openerId: null,
    isPasskeyBlocked: false,
  };
  live = [...live, facts];
  return facts;
};

const answerPick = ({ args }: PickArgs): BrowserPickRead => {
  if (args.op === 'start') {
    page = { ...page, isOn: true, isLeft: false, round: page.round + 1, picks: [] };
  }
  if (args.op === 'stop') {
    page = { ...page, isOn: false, round: page.round + 1 };
  }
  return page;
};

const answerCrop = async (): Promise<string> => {
  if (cropMode === 'wait') {
    await new Promise<void>((resolve) => {
      releaseCrop = resolve;
    });
  }
  return CROP;
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
    browser_tab_row_save: null,
    browser_tab_open: ({ args }: OpenArgs) => factsOf({ args }),
    browser_tab_list: () => live,
    browser_history_state: null,
    browser_console_read: { doc: null, entries: [], watermark: 0, isHeard: false },
    browser_favicon: null,
    browser_tab_place: null,
    browser_tab_show: ({ args }: TabArgs) => live.find((facts) => facts.id === args.tabId),
    browser_tab_hide: ({ args }: TabArgs) => live.find((facts) => facts.id === args.tabId),
    browser_tab_reload: null,
    browser_pick: answerPick,
    browser_element_snapshot: answerCrop,
    monitor_snapshot: { listeners: [], processes: [], takenAt: 1, isPlatformSupported: true },
    process_ledger_list: [],
    monitor_watched_ports: [],
  });
};

const opOf = ({ payload }: PayloadParams): unknown => {
  const args: unknown =
    typeof payload === 'object' && payload !== null ? Reflect.get(payload, 'args') : null;
  return typeof args === 'object' && args !== null ? Reflect.get(args, 'op') : null;
};

const pickCalls = () =>
  storySpies.tauriInvoke.mock.calls
    .filter(([name]) => name === 'browser_pick')
    .map(([, payload]) => opOf({ payload }));

const queued = ({ agentId }: AgentParams) => store.getState().outputHandoffs[agentId] ?? [];

const draftOf = ({ agentId }: AgentParams) => store.getState().agentDraft[agentId] ?? '';

const studioOf = ({ sessionId, tabId }: StudioParams) => (
  <ToastProvider>
    <ObjectMenuProvider>
      <BrowserStudio sessionId={sessionId} tabId={tabId} onClose={() => undefined} />
    </ObjectMenuProvider>
  </ToastProvider>
);

const openLedgerPage = async () => {
  store.getState().switchStudio({
    studio: { kind: 'browser', sessionId: ROUNDING_SESSION, tabId: 'tab-ledger' },
  });
  const { rerender } = render(studioOf({ sessionId: ROUNDING_SESSION, tabId: 'tab-ledger' }));
  const view = await waitFor(() => {
    const found = document.querySelector('[data-browser-view]');
    if (found === null) {
      throw new Error('The page draws no view placeholder yet.');
    }
    return found;
  });
  Object.defineProperty(view, 'getBoundingClientRect', {
    configurable: true,
    value: () => new DOMRect(VIEW_RECT.x, VIEW_RECT.y, VIEW_RECT.width, VIEW_RECT.height),
  });
  Object.defineProperty(view, 'checkVisibility', { configurable: true, value: () => true });
  await waitFor(() =>
    expect(store.getState().browserActiveTab[ROUNDING_SESSION]).toBe('tab-ledger'),
  );
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Select an element' })).toHaveProperty(
      'disabled',
      false,
    ),
  );
  return { rerender };
};

const startPicking = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Select an element' }));
  });
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Select an element' }).getAttribute('aria-pressed'),
    ).toBe('true'),
  );
};

const clickInPage = async ({ elements }: ClickParams) => {
  page = { ...page, round: page.round + 1, picks: elements };
  return screen.findByRole('textbox', { name: 'What should change?' });
};

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  live = [];
  opened = 0;
  cropMode = 'ok';
  releaseCrop = null;
  page = {
    doc: 'r7q2',
    isHeard: true,
    isOn: false,
    isLeft: false,
    round: 0,
    scale: 2,
    picks: [],
  };
  rows = [
    rowOf({
      id: 'tab-checkout',
      owner: { kind: 'session', sessionId: CHECKOUT_SESSION },
      url: 'http://localhost:5173/checkout',
      title: 'Checkout',
      position: 0,
    }),
    rowOf({
      id: 'tab-ledger',
      owner: { kind: 'session', sessionId: ROUNDING_SESSION },
      url: 'http://localhost:5174/ledger',
      title: 'Ledger',
      position: 0,
    }),
    rowOf({
      id: 'tab-pr',
      owner: { kind: 'session', sessionId: ROUNDING_SESSION },
      url: 'https://git.northwind.dev/ledger-core/pull/318',
      title: 'PR #318',
      position: 1,
    }),
  ];
  await resetStoryStore();
  await openStorySqlite();
  store.setState({
    currentWorkspaceId: WORKSPACE_ID,
    projects: [PAYMENTS_API],
    sessions: [
      buildStorySession({
        id: CHECKOUT_SESSION,
        workspaceId: WORKSPACE_ID,
        goal: 'Show tax in the checkout total',
      }),
      buildStorySession({
        id: ROUNDING_SESSION,
        workspaceId: WORKSPACE_ID,
        goal: 'Fix the rounding drift',
      }),
    ],
    currentSessionId: CHECKOUT_SESSION,
    sessionPhaseRuns: {
      [ROUNDING_SESSION]: [
        buildStoryAgent({ id: IMPLEMENTER, sessionId: ROUNDING_SESSION, name: 'Implementer' }),
        buildStoryAgent({ id: REVIEWER, sessionId: ROUNDING_SESSION, name: 'Reviewer' }),
      ],
    },
    selectedAgentId: { [ROUNDING_SESSION]: IMPLEMENTER },
    sessionProjectMounts: {
      [ROUNDING_SESSION]: [
        mountFixture({ sessionId: ROUNDING_SESSION, projectId: PAYMENTS_API.id }),
      ],
    },
  });
  stubHost();
});

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
});

describe('select an element on the browser page', () => {
  it('starts from the Select an element button in the page row', async () => {
    await openLedgerPage();

    const row = document.querySelector<HTMLElement>('[data-browser-page] [data-browser-row]');
    expect(row?.contains(screen.getByRole('button', { name: 'Select an element' }))).toBe(true);
    await startPicking();

    expect(pickCalls()).toEqual(expect.arrayContaining(['start']));
  });

  it('starts on the key while the page is on screen', async () => {
    await openLedgerPage();

    await act(async () => {
      pressShortcut({ id: 'browser.pick' });
    });

    await waitFor(() => expect(pickCalls()).toEqual(expect.arrayContaining(['start'])));
  });

  it('opens the note under the row on the page and names the agent of the tab session', async () => {
    await openLedgerPage();
    await startPicking();

    await clickInPage({ elements: [TOTAL] });

    const card = screen.getByRole('group', { name: 'Note for the picked element' });
    expect(card.closest('[data-browser-page]')).not.toBeNull();
    expect(card.textContent).toContain('<LedgerTotal>  src/ledger/LedgerTotal.tsx:17');
    expect(card.textContent).toContain('To Implementer');
  });

  it('adds to the composer of the tab session and keeps the user on the Browser page', async () => {
    await openLedgerPage();
    await startPicking();
    const note = await clickInPage({ elements: [TOTAL] });
    fireEvent.change(note, { target: { value: NOTE } });

    await act(async () => {
      fireEvent.keyDown(note, { key: 'Enter' });
    });

    await waitFor(() => expect(queued({ agentId: IMPLEMENTER })).toHaveLength(2));
    expect(draftOf({ agentId: IMPLEMENTER })).toBe(NOTE);
    expect(queued({ agentId: REVIEWER })).toEqual([]);
    expect(store.getState().currentSessionId).toBe(CHECKOUT_SESSION);
    expect(store.getState().appStudio).toEqual(
      expect.objectContaining({ kind: 'browser', sessionId: ROUNDING_SESSION }),
    );
    expect(storySpies.tauriInvoke.mock.calls.map(([name]) => name)).not.toContain('turn_send');
  });

  it('drops a late picture once another tab of the session is shown', async () => {
    cropMode = 'wait';
    await openLedgerPage();
    await startPicking();
    const note = await clickInPage({ elements: [TOTAL] });
    await act(async () => {
      fireEvent.keyDown(note, { key: 'Enter' });
    });
    await waitFor(() => expect(releaseCrop).not.toBeNull());

    fireEvent.click(screen.getByRole('button', { name: 'PR #318' }));
    await waitFor(() => expect(store.getState().browserActiveTab[ROUNDING_SESSION]).toBe('tab-pr'));
    await waitFor(() => expect(live.map((facts) => facts.id)).toEqual(['live-1', 'live-2']));
    await act(async () => {
      releaseCrop?.();
    });

    await waitFor(() => expect(queued({ agentId: IMPLEMENTER })).toHaveLength(1));
    expect(queued({ agentId: IMPLEMENTER })[0]?.mimeType).toBe('text/markdown');
  });

  it('drops a late picture once a tab of another session is shown', async () => {
    cropMode = 'wait';
    const { rerender } = await openLedgerPage();
    await startPicking();
    const note = await clickInPage({ elements: [TOTAL] });
    await act(async () => {
      fireEvent.keyDown(note, { key: 'Enter' });
    });
    await waitFor(() => expect(releaseCrop).not.toBeNull());

    await act(async () => {
      rerender(studioOf({ sessionId: CHECKOUT_SESSION, tabId: 'tab-checkout' }));
    });
    await waitFor(() =>
      expect(store.getState().browserActiveTab[CHECKOUT_SESSION]).toBe('tab-checkout'),
    );
    await act(async () => {
      releaseCrop?.();
    });

    await waitFor(() => expect(queued({ agentId: IMPLEMENTER })).toHaveLength(1));
    expect(queued({ agentId: IMPLEMENTER })[0]?.mimeType).toBe('text/markdown');
  });
});
