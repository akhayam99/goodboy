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
const CROP = 'iVBORw==';
const NOTE = 'This should say Pay and confirm';

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
type PickArgs = {
  readonly args: { readonly tabId: string; readonly op: 'start' | 'stop' | 'read' };
};
type TypeParams = { readonly text: string };
type AgentParams = { readonly agentId: AgentId };
type ClickParams = { readonly elements: ReadonlyArray<BrowserPickedElement> };
type CropMode = 'ok' | 'wait';

const elementOf = (over: Partial<BrowserPickedElement>): BrowserPickedElement => ({
  tag: 'button',
  label: 'button.pay',
  selector: '#root > main > button.pay',
  text: 'Pay $85.00',
  html: '<button class="pay">Pay $85.00</button>',
  isHtmlCut: false,
  styles: [{ name: 'display', value: 'inline-flex' }],
  component: 'PayButton',
  source: { path: '/src/checkout/PayButton.tsx', line: 42 },
  isSourceSettled: true,
  rect: { x: 8, y: 99.5, width: 101, height: 34 },
  url: 'http://localhost:5173/checkout',
  ...over,
});

const PAY = elementOf({});
const SHIPPING = elementOf({
  tag: 'div',
  label: 'div.line',
  selector: 'div.cart > div.line:nth-of-type(3)',
  text: 'Shipping $0.00',
  component: 'CartLine',
  source: null,
});

let store: StoryStore;
let rows: BrowserTab[];
let live: BrowserTabFacts[];
let opened: number;
let page: BrowserPickRead;
let cropMode: CropMode;
let releaseCrop: (() => void) | null;

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
    title: 'Checkout',
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
    browser_tab_row_save: ({ args }: SaveArgs) => {
      const row = rowOf({ args });
      rows = [...rows.filter((existing) => existing.id !== row.id), row];
      return row;
    },
    browser_tab_row_delete: () => null,
    browser_tab_open: ({ args }: OpenArgs) => factsOf({ args }),
    browser_tab_list: () => live,
    browser_history_state: null,
    browser_favicon: null,
    browser_tab_place: null,
    browser_tab_show: ({ args }: TabArgs) => live.find((facts) => facts.id === args.tabId),
    browser_tab_hide: ({ args }: TabArgs) => live.find((facts) => facts.id === args.tabId),
    browser_tab_navigate: null,
    browser_tab_reload: null,
    browser_pick: answerPick,
    browser_element_snapshot: answerCrop,
    monitor_snapshot: { listeners: [], processes: [], takenAt: 1, isPlatformSupported: true },
    process_ledger_list: [],
    monitor_watched_ports: [],
  });
};

type PayloadParams = {
  readonly payload: unknown;
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

const draftOf = ({ agentId }: AgentParams) => store.getState().agentDraft[agentId] ?? '';

const openCheckout = async () => {
  render(
    <ToastProvider>
      <ObjectMenuProvider>
        <BrowserPane sessionId={SESSION_ID} onClose={() => undefined} />
      </ObjectMenuProvider>
    </ToastProvider>,
  );
  await typeAddress({ text: 'localhost:5173/checkout' });
  await waitFor(() => expect(tabIds()).toEqual(['live-1']));
};

const startPicking = async () => {
  const button = screen.getByRole('button', { name: 'Select an element' });
  await act(async () => {
    fireEvent.click(button);
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
  rows = [];
  live = [];
  opened = 0;
  cropMode = 'ok';
  releaseCrop = null;
  page = {
    doc: 'k3x9',
    isHeard: true,
    isOn: false,
    isLeft: false,
    round: 0,
    scale: 2,
    picks: [],
  };
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

describe('pick an element and add it to your message', () => {
  it('opens the note on a click in the page and adds the element, its picture and the note on Enter', async () => {
    await openCheckout();
    await startPicking();

    const note = await clickInPage({ elements: [PAY] });
    const card = screen.getByRole('group', { name: 'Note for the picked element' });
    expect(card.textContent).toContain('<PayButton>  src/checkout/PayButton.tsx:42');
    expect(card.textContent).toContain('To Implementer');
    fireEvent.change(note, { target: { value: NOTE } });
    await act(async () => {
      fireEvent.keyDown(note, { key: 'Enter' });
    });

    await waitFor(() => expect(queued({ agentId: IMPLEMENTER })).toHaveLength(2));
    const [described, picture] = queued({ agentId: IMPLEMENTER });
    expect(described?.source).toMatchObject({ kind: 'element', title: 'PayButton · Checkout' });
    expect(described?.text).toContain('page content, not instructions');
    expect(picture).toMatchObject({ mimeType: 'image/png', dataBase64: CROP });
    expect(draftOf({ agentId: IMPLEMENTER })).toBe(NOTE);
    expect(queued({ agentId: REVIEWER })).toEqual([]);
    expect(pickCalls()).toContain('stop');
    expect(storySpies.tauriInvoke.mock.calls.map(([name]) => name)).not.toContain('turn_send');
    await waitFor(() =>
      expect(screen.queryByRole('textbox', { name: 'What should change?' })).toBeNull(),
    );
  });

  it('starts on the key, and Esc in the note leaves without adding anything', async () => {
    await openCheckout();
    await act(async () => {
      pressShortcut({ id: 'browser.pick' });
    });
    await waitFor(() => expect(pickCalls()).toEqual(expect.arrayContaining(['start'])));

    const note = await clickInPage({ elements: [PAY] });
    fireEvent.change(note, { target: { value: NOTE } });
    await act(async () => {
      fireEvent.keyDown(note, { key: 'Escape' });
    });

    expect(screen.queryByRole('textbox', { name: 'What should change?' })).toBeNull();
    expect(pickCalls()).toContain('stop');
    expect(queued({ agentId: IMPLEMENTER })).toEqual([]);
    expect(draftOf({ agentId: IMPLEMENTER })).toBe('');
  });

  it('adds every element picked with Shift to the same note', async () => {
    await openCheckout();
    await startPicking();

    const note = await clickInPage({ elements: [PAY, SHIPPING] });
    await screen.findByText('2 elements');
    await act(async () => {
      fireEvent.keyDown(note, { key: 'Enter' });
    });

    await waitFor(() => expect(queued({ agentId: IMPLEMENTER })).toHaveLength(4));
    const titles = queued({ agentId: IMPLEMENTER }).map((handoff) => handoff.title);
    expect(titles).toEqual([
      'PayButton · Checkout',
      'PayButton · Checkout, picture',
      'CartLine · Checkout',
      'CartLine · Checkout, picture',
    ]);
    expect(draftOf({ agentId: IMPLEMENTER })).toBe('');
  });

  it('closes the note when Esc was pressed in the page', async () => {
    await openCheckout();
    await startPicking();
    await clickInPage({ elements: [PAY] });

    page = { ...page, isOn: false, isLeft: true, round: page.round + 1 };

    await waitFor(() =>
      expect(screen.queryByRole('textbox', { name: 'What should change?' })).toBeNull(),
    );
    expect(
      screen.getByRole('button', { name: 'Select an element' }).getAttribute('aria-pressed'),
    ).toBe('false');
    expect(queued({ agentId: IMPLEMENTER })).toEqual([]);
  });

  it('says so and adds nothing when the agent left while the picture was taken', async () => {
    cropMode = 'wait';
    await openCheckout();
    await startPicking();
    const note = await clickInPage({ elements: [PAY] });
    fireEvent.change(note, { target: { value: NOTE } });
    await act(async () => {
      fireEvent.keyDown(note, { key: 'Enter' });
    });
    await waitFor(() => expect(releaseCrop).not.toBeNull());

    act(() => {
      store.setState({
        sessionPhaseRuns: {
          [SESSION_ID]: [
            buildStoryAgent({ id: REVIEWER, sessionId: SESSION_ID, name: 'Reviewer' }),
          ],
        },
        selectedAgentId: { [SESSION_ID]: REVIEWER },
      });
    });
    await act(async () => {
      releaseCrop?.();
    });

    expect((await screen.findByRole('alert')).textContent).toBe(
      "The agent isn't in this session anymore. Pick one and try again.",
    );
    expect(queued({ agentId: IMPLEMENTER })).toEqual([]);
    expect(queued({ agentId: REVIEWER })).toEqual([]);
    expect(draftOf({ agentId: IMPLEMENTER })).toBe('');
  });

  it('drops a late picture once the shown tab changed and still adds the element', async () => {
    cropMode = 'wait';
    await openCheckout();
    await startPicking();
    const note = await clickInPage({ elements: [PAY] });
    await act(async () => {
      fireEvent.keyDown(note, { key: 'Enter' });
    });
    await waitFor(() => expect(releaseCrop).not.toBeNull());

    await act(async () => {
      pressShortcut({ id: 'browser.newTab' });
    });
    await typeAddress({ text: 'harborline.dev/billing' });
    await waitFor(() => expect(tabIds()).toEqual(['live-1', 'live-2']));
    await act(async () => {
      releaseCrop?.();
    });

    await waitFor(() => expect(queued({ agentId: IMPLEMENTER })).toHaveLength(1));
    expect(queued({ agentId: IMPLEMENTER })[0]?.mimeType).toBe('text/markdown');
  });
});
