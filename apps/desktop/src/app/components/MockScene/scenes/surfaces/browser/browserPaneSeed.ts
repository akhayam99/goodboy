import { brandId, type ProjectId, type SessionId } from '@goodboy/types';
import { browserTabListPref } from '../../../../../../features/browser/browserTabListPref';
import { pinProjectOf } from '../../../../../../features/browser/pinProjectOf';
import type { BrowserTabFacts, BrowserTabListMode } from '../../../../../../features/browser/types';
import { useAppStore } from '../../../../../../store';
import type { BrowserTab } from '../../../../../../store/slices/browser/types';
import type { BrowserVisit } from '../../../../../../store/slices/browser-visits/types';
import { SESSION, SESSION_ID, seedActivityRunScene } from '../../activityRunSeed';
import { mockSceneIpc } from '../../mockSceneIpc';

export type BrowserPaneSceneState =
  | 'pane'
  | 'tabs'
  | 'rail'
  | 'page'
  | 'peek'
  | 'address'
  | 'field'
  | 'more'
  | 'passkey'
  | 'loading'
  | 'keys'
  | 'find'
  | 'find-missing'
  | 'cover'
  | 'saved-copy';

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

type ListModeParams = {
  readonly state: BrowserPaneSceneState;
};

const listModeOf = ({ state }: ListModeParams): BrowserTabListMode => {
  if (state === 'tabs') {
    return 'list';
  }
  return state === 'rail' ? 'rail' : 'hidden';
};

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
  browserTabListPref.write({ mode: listModeOf({ state }) });
  useAppStore.setState({
    browserSessionTabs: { [SESSION_ID]: tabs },
    browserActiveTab: { [SESSION_ID]: 'mock-browser-checkout' },
    browserShownPin: { [SESSION_ID]: null },
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
