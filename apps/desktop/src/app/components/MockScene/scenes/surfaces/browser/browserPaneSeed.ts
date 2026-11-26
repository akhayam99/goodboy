import { brandId, type ProjectId, type SessionId } from '@goodboy/types';
import {
  browserToolsDockPref,
  type BrowserToolsSide,
} from '../../../../../../features/browser/browserToolsDockPref';
import { pinProjectOf } from '../../../../../../features/browser/pinProjectOf';
import type {
  BrowserConsoleEntry,
  BrowserConsoleRead,
  BrowserPickRead,
  BrowserRequestFacts,
  BrowserTabFacts,
} from '../../../../../../features/browser/types';
import { useAppStore } from '../../../../../../store';
import type { BrowserTab, DevicePresetId } from '../../../../../../store/slices/browser/types';
import type { BrowserVisit } from '../../../../../../store/slices/browser-visits/types';
import { SESSION, SESSION_ID, seedActivityRunScene } from '../../activityRunSeed';
import { mockSceneIpc } from '../../mockSceneIpc';
import { sceneClock } from '../../../sceneClock';
import { NETWORK_READ } from './browserNetworkRead';

export type BrowserPaneSceneState =
  | 'pane'
  | 'tabs'
  | 'page'
  | 'peek'
  | 'address'
  | 'field'
  | 'more'
  | 'handoff'
  | 'passkey'
  | 'loading'
  | 'keys'
  | 'find'
  | 'find-missing'
  | 'cover'
  | 'saved-copy'
  | 'width-phone'
  | 'width-tablet'
  | 'console'
  | 'console-right'
  | 'network'
  | 'network-detail'
  | 'pick'
  | 'errors';

const PICK_READ: BrowserPickRead = {
  doc: 'mockload',
  isHeard: true,
  isOn: true,
  isLeft: false,
  round: 2,
  scale: 2,
  picks: [
    {
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
      rect: { x: 312, y: 388, width: 101, height: 34 },
      url: 'http://localhost:5173/checkout',
    },
  ],
};

const IDLE_PICK: BrowserPickRead = {
  ...PICK_READ,
  doc: null,
  isHeard: false,
  isOn: false,
  picks: [],
};

const CONSOLE_STATES: ReadonlyArray<BrowserPaneSceneState> = [
  'console',
  'console-right',
  'network',
  'network-detail',
  'errors',
];

const NETWORK_STATES: ReadonlyArray<BrowserPaneSceneState> = ['network', 'network-detail'];

const DOCK_SIDE_OF: Readonly<Partial<Record<BrowserPaneSceneState, BrowserToolsSide>>> = {
  'console-right': 'right',
};

type RequestParams = {
  readonly id: string;
  readonly duration: number;
  readonly size: number;
};

const requestFactsOf = ({ id, duration, size }: RequestParams): BrowserRequestFacts => ({
  id,
  type: 'fetch',
  start: 0,
  duration,
  size,
  requestHeaders: [],
  responseHeaders: [],
  requestBody: null,
  responseBody: null,
  socket: null,
});

const CONSOLE_READ: BrowserConsoleRead = {
  doc: 'mockload',
  watermark: 0,
  isHeard: true,
  entries: [
    {
      seq: 1,
      kind: 'console',
      level: 'error',
      text: 'TypeError: retry is not a function',
      source: 'checkout.js:214',
      method: null,
      status: null,
      network: null,
      error: null,
    },
    {
      seq: 2,
      kind: 'console',
      level: 'warn',
      text: 'Line "Shipping" was rendered twice',
      source: 'CartLines.tsx:58',
      method: null,
      status: null,
      network: null,
      error: null,
    },
    {
      seq: 3,
      kind: 'console',
      level: 'info',
      text: 'payments-api: rates cached for 5 minutes',
      source: 'rates.ts:31',
      method: null,
      status: null,
      network: null,
      error: null,
    },
    {
      seq: 4,
      kind: 'console',
      level: 'log',
      text: 'ledger-core: confirm step mounted',
      source: 'confirm.ts:12',
      method: null,
      status: null,
      network: null,
      error: null,
    },
    {
      seq: 5,
      kind: 'network',
      level: 'error',
      text: '/api/orders/confirm',
      source: null,
      method: 'POST',
      status: 500,
      network: requestFactsOf({ id: 'mock-request-confirm', duration: 380, size: 38 }),
      error: null,
    },
    {
      seq: 6,
      kind: 'network',
      level: 'info',
      text: '/api/cart',
      source: null,
      method: 'GET',
      status: 200,
      network: requestFactsOf({ id: 'mock-request-cart', duration: 42, size: 2048 }),
      error: null,
    },
    {
      seq: 7,
      kind: 'network',
      level: 'info',
      text: '/assets/checkout.js',
      source: null,
      method: 'GET',
      status: null,
      network: null,
      error: null,
    },
  ],
};

const RETRY_STACK = [
  'TypeError: retry is not a function',
  '    at chargeCard (http://localhost:5173/src/checkout/retry.ts?t=1764075731000:214:9)',
  '    at onPay (http://localhost:5173/src/checkout/PayButton.tsx:51:5)',
  '    at dispatchEvent (http://localhost:5173/node_modules/.vite/deps/react-dom.js?v=4f2a:4213:14)',
].join('\n');

const TIMEOUT_STACK = [
  'Error: Timeout after 8000 ms',
  '    at waitForCharge (http://localhost:5173/src/lib/poll.ts:31:11)',
  '    at onPay (http://localhost:5173/src/checkout/PayButton.tsx:55:7)',
].join('\n');

const PAY_AT = sceneClock({ anchor: '2026-11-25T13:03:00.000Z' }).ms({
  at: '2026-11-25T13:02:11.000Z',
});

type RetryParams = {
  readonly seq: number;
  readonly at: number;
};

const retryEntryOf = ({ seq, at }: RetryParams): BrowserConsoleEntry => ({
  seq,
  kind: 'error',
  level: 'error',
  text: 'TypeError: retry is not a function',
  source: 'retry.ts:214',
  method: null,
  status: null,
  network: null,
  error: { origin: 'uncaught', stack: RETRY_STACK, requestId: null, at },
});

const ERRORS_READ: BrowserConsoleRead = {
  doc: 'mockload',
  watermark: 0,
  isHeard: true,
  entries: [
    retryEntryOf({ seq: 1, at: PAY_AT }),
    retryEntryOf({ seq: 2, at: PAY_AT + 2_000 }),
    retryEntryOf({ seq: 3, at: PAY_AT + 5_000 }),
    {
      seq: 4,
      kind: 'network',
      level: 'error',
      text: '/api/charge',
      source: null,
      method: 'POST',
      status: 500,
      network: {
        ...requestFactsOf({ id: 'mock-request-charge', duration: 380, size: 38 }),
        responseBody: '{"error":"idempotency key reused"}',
      },
      error: null,
    },
    {
      seq: 5,
      kind: 'error',
      level: 'error',
      text: 'POST /api/charge 500',
      source: null,
      method: null,
      status: null,
      network: null,
      error: {
        origin: 'request',
        stack: null,
        requestId: 'mock-request-charge',
        at: PAY_AT + 8_000,
      },
    },
    retryEntryOf({ seq: 6, at: PAY_AT + 8_000 }),
    {
      seq: 7,
      kind: 'error',
      level: 'error',
      text: 'Unhandled rejection: Timeout after 8000 ms',
      source: 'poll.ts:31',
      method: null,
      status: null,
      network: null,
      error: { origin: 'rejection', stack: TIMEOUT_STACK, requestId: null, at: PAY_AT + 16_000 },
    },
  ],
};

const UNHEARD_READ: BrowserConsoleRead = { doc: null, entries: [], watermark: 0, isHeard: false };

const DEVICE_PRESETS_OF: Readonly<
  Partial<Record<BrowserPaneSceneState, Readonly<Record<string, DevicePresetId>>>>
> = {
  'width-phone': { 'mock-browser-checkout': 'phone' },
  'width-tablet': { 'mock-browser-checkout': 'tablet' },
};

const VISITS: ReadonlyArray<BrowserVisit> = [
  { url: 'http://localhost:5173/checkout/confirm', title: 'Confirm order', visitedAt: 3 },
  { url: 'http://localhost:5173/checkout', title: 'Checkout', visitedAt: 2 },
  { url: 'https://docs.harborline.dev/tax', title: 'Tax rates', visitedAt: 1 },
];

const CHECKOUT_ORIGIN = 'http://localhost:5173';
const CHECKOUT_FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect width='16' height='16' rx='3' fill='%23e8590c'/%3E%3Ccircle cx='8' cy='8' r='3' fill='white'/%3E%3C/svg%3E";

const PEEK_DECISION =
  'Check the tax line on [localhost:5173/checkout](http://localhost:5173/checkout) before the PR goes up';

type SeedParams = {
  readonly state: BrowserPaneSceneState;
};

type RowParams = {
  readonly id: string;
  readonly url: string;
  readonly title: string;
  readonly sessionId: SessionId | null;
  readonly projectId: ProjectId | null;
  readonly position: number;
};

type PeekParams = {
  readonly tabs: ReadonlyArray<BrowserTab>;
};

type PayloadParams = {
  readonly payload: unknown;
};

type FieldParams = PayloadParams & {
  readonly field: string;
};

const fieldOf = ({ payload, field }: FieldParams): unknown => {
  const args: unknown =
    typeof payload === 'object' && payload !== null ? Reflect.get(payload, 'args') : null;
  return typeof args === 'object' && args !== null ? Reflect.get(args, field) : undefined;
};

const textOf = ({ payload, field }: FieldParams): string => {
  const value = fieldOf({ payload, field });
  return typeof value === 'string' ? value : '';
};

type ConsoleReadParams = PayloadParams & {
  readonly state: BrowserPaneSceneState;
};

const readOfState = ({ state }: SeedParams): BrowserConsoleRead => {
  if (NETWORK_STATES.includes(state)) {
    return NETWORK_READ;
  }
  return state === 'errors' ? ERRORS_READ : CONSOLE_READ;
};

const consoleReadOf = ({ state, payload }: ConsoleReadParams): BrowserConsoleRead => {
  if (!CONSOLE_STATES.includes(state)) {
    return UNHEARD_READ;
  }
  const read = readOfState({ state });
  if (fieldOf({ payload, field: 'doc' }) === read.doc) {
    return { ...read, entries: [] };
  }
  return read;
};

const isProjectOwner = ({ payload }: PayloadParams): boolean => {
  const owner = fieldOf({ payload, field: 'owner' });
  return typeof owner === 'object' && owner !== null && Reflect.get(owner, 'kind') === 'project';
};

const ownerSessionOf = ({ payload }: PayloadParams): unknown => {
  const owner = fieldOf({ payload, field: 'owner' });
  return typeof owner === 'object' && owner !== null ? Reflect.get(owner, 'sessionId') : null;
};

const SIGN_IN_URL = 'https://id.cascadia.dev/signin';

const SAVED_COPY_URL = 'file:///mirror/rounding-drift/index.html';

type FirstTabParams = {
  readonly isPasskey: boolean;
  readonly isSavedCopy: boolean;
};

const firstTabAddress = ({ isPasskey, isSavedCopy }: FirstTabParams): string => {
  if (isSavedCopy) {
    return SAVED_COPY_URL;
  }
  return isPasskey ? SIGN_IN_URL : 'http://localhost:5173/checkout';
};

const firstTabTitle = ({ isPasskey, isSavedCopy }: FirstTabParams): string => {
  if (isSavedCopy) {
    return 'Rounding drift';
  }
  return isPasskey ? 'Sign in to Cascadia' : 'Checkout';
};

const ROUNDING_ID = brandId<SessionId>({ value: 'mock-browser-rounding' });

const rowOf = ({ id, url, title, sessionId, projectId, position }: RowParams): BrowserTab => ({
  id,
  url,
  title,
  sessionId,
  projectId,
  position,
  createdAt: 1,
  updatedAt: 1,
});

const MORE_TABS: ReadonlyArray<Pick<BrowserTab, 'id' | 'url' | 'title'>> = [
  {
    id: 'mock-browser-webhooks',
    url: 'https://docs.notify-relay.dev/webhooks',
    title: 'notify-relay webhooks',
  },
  { id: 'mock-browser-ledger', url: 'http://localhost:5173/ledger', title: 'Ledger entries' },
  {
    id: 'mock-browser-payments',
    url: 'http://localhost:4000/payments',
    title: 'payments-api health',
  },
  { id: 'mock-browser-acme', url: 'https://acme.example/invoices', title: 'Acme invoices' },
];

const factsOf = ({
  id,
  url,
  title,
}: Pick<BrowserTab, 'id' | 'url' | 'title'>): BrowserTabFacts => ({
  id: `mock-live-${id}`,
  sessionId: SESSION_ID,
  url,
  title,
  state: id === 'mock-browser-tax' ? 'asleep' : 'live',
  isShown: false,
  hiddenSinceMs: null,
  openerId: null,
  isPasskeyBlocked: false,
});

const seedPeek = ({ tabs }: PeekParams): void => {
  useAppStore.setState((current) => ({
    browserSessionTabs: { [SESSION_ID]: tabs },
    sessionDecisions: {
      ...current.sessionDecisions,
      [SESSION_ID]: (current.sessionDecisions[SESSION_ID] ?? []).map((row) =>
        row.number === 2 ? { ...row, text: PEEK_DECISION } : row,
      ),
    },
  }));
  useAppStore.setState({ navigate: useAppStore.getInitialState().navigate });
  useAppStore.getState().openContextDrawer({ sessionId: SESSION_ID, section: 'decisions' });
};

export const seedBrowserPane = ({ state }: SeedParams): void => {
  seedActivityRunScene();
  const projectId = pinProjectOf({ state: useAppStore.getState(), sessionId: SESSION_ID });
  const isPasskey = state === 'passkey';
  const isSavedCopy = state === 'saved-copy';
  const tabs = [
    rowOf({
      id: 'mock-browser-checkout',
      url: firstTabAddress({ isPasskey, isSavedCopy }),
      title: firstTabTitle({ isPasskey, isSavedCopy }),
      sessionId: SESSION_ID,
      projectId: null,
      position: 0,
    }),
    rowOf({
      id: 'mock-browser-tax',
      url: 'https://docs.harborline.dev/tax',
      title: 'Tax rates',
      sessionId: SESSION_ID,
      projectId: null,
      position: 1,
    }),
    ...(state === 'tabs' ? MORE_TABS : []).map((tab, index) =>
      rowOf({ ...tab, sessionId: SESSION_ID, projectId: null, position: index + 2 }),
    ),
  ];
  const pins =
    projectId === null
      ? []
      : [
          rowOf({
            id: 'mock-browser-staging',
            url: 'https://staging.harborline.dev/checkout',
            title: 'Staging checkout',
            sessionId: null,
            projectId,
            position: 0,
          }),
        ];
  const roundingTabs = [
    rowOf({
      id: 'mock-browser-pr',
      url: 'https://git.northwind.dev/ledger-core/pull/318',
      title: 'PR #318',
      sessionId: ROUNDING_ID,
      projectId: null,
      position: 0,
    }),
  ];
  let live = tabs
    .map(factsOf)
    .map((facts, index) => ({ ...facts, isPasskeyBlocked: isPasskey && index === 0 }));
  let opened = 0;
  browserToolsDockPref.write({
    surface: 'pane',
    place: { side: DOCK_SIDE_OF[state] ?? 'bottom', height: 210, width: 360 },
  });
  if (state === 'peek') {
    seedPeek({ tabs });
    return;
  }
  mockSceneIpc((command, payload) => {
    switch (command) {
      case 'browser_tab_rows_list':
        if (isProjectOwner({ payload })) {
          return pins;
        }
        return ownerSessionOf({ payload }) === ROUNDING_ID ? roundingTabs : tabs;
      case 'browser_workspace_tab_rows_list':
        return [...tabs, ...roundingTabs, ...pins];
      case 'browser_tab_list':
        return live;
      case 'browser_history_state':
        return { canGoBack: true, canGoForward: false };
      case 'browser_favicon':
        return { origin: CHECKOUT_ORIGIN, src: CHECKOUT_FAVICON };
      case 'browser_tab_stop':
        return null;
      case 'browser_find':
        return { isFound: textOf({ payload, field: 'needle' }) === 'retry' };
      case 'browser_console_read':
        return consoleReadOf({ state, payload });
      case 'browser_pick':
        return state === 'pick' ? PICK_READ : IDLE_PICK;
      case 'monitor_snapshot':
        return { listeners: [], processes: [], takenAt: 1, isPlatformSupported: true };
      case 'process_ledger_list':
      case 'monitor_watched_ports':
        return [];
      case 'browser_visits_list':
        return VISITS;
      case 'browser_tab_open':
        opened += 1;
        return factsOf({
          id: `opened-${opened}`,
          url: textOf({ payload, field: 'url' }),
          title: '',
        });
      case 'browser_tab_passkey_dismiss': {
        const tabId = textOf({ payload, field: 'tabId' });
        live = live.map((facts) =>
          facts.id === tabId ? { ...facts, isPasskeyBlocked: false } : facts,
        );
        return live.find((facts) => facts.id === tabId) ?? null;
      }
      case 'browser_tab_show':
      case 'browser_tab_hide':
        return live.find((facts) => facts.id === textOf({ payload, field: 'tabId' })) ?? live[0];
      default:
        return null;
    }
  });
  useAppStore.setState({
    browserSessionTabs: { [SESSION_ID]: tabs },
    browserActiveTab: { [SESSION_ID]: 'mock-browser-checkout' },
    browserShownPin: { [SESSION_ID]: null },
    browserDevicePresets: DEVICE_PRESETS_OF[state] ?? {},
    browserLiveTabs: {
      [SESSION_ID]: Object.fromEntries(tabs.map((tab) => [tab.id, `mock-live-${tab.id}`])),
    },
    ...(projectId === null ? {} : { browserProjectPins: { [projectId]: pins } }),
    browserLoads:
      state === 'loading'
        ? { 'mock-live-mock-browser-checkout': { url: tabs[0]?.url ?? '', startedAt: 1 } }
        : {},
  });
  if (state === 'page' || state === 'keys') {
    useAppStore.setState((current) => ({
      sessions: [
        ...current.sessions,
        { ...SESSION, id: ROUNDING_ID, goal: 'Fix the rounding drift', workflowRuns: [] },
      ],
      browserSessionTabs: { ...current.browserSessionTabs, [ROUNDING_ID]: roundingTabs },
    }));
  }
  useAppStore.getState().openDrawer({ kind: 'browser', sessionId: SESSION_ID, payload: null });
};
