import { brandId, type ProjectId, type SessionId } from '@goodboy/types';
import { browserTabListPref } from '../../../../../../features/browser/browserTabListPref';
import { pinProjectOf } from '../../../../../../features/browser/pinProjectOf';
import type { BrowserTabFacts } from '../../../../../../features/browser/types';
import { useAppStore } from '../../../../../../store';
import type { BrowserTab } from '../../../../../../store/slices/browser/types';
import { SESSION, SESSION_ID, seedActivityRunScene } from '../../activityRunSeed';
import { mockSceneIpc } from '../../mockSceneIpc';

export type BrowserPaneSceneState = 'pane' | 'tabs' | 'page';

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

const factsOf = ({
  id,
  url,
  title,
}: Pick<BrowserTab, 'id' | 'url' | 'title'>): BrowserTabFacts => ({
  id: `mock-live-${id}`,
  sessionId: SESSION_ID,
  url,
  title,
  isShown: false,
  hiddenSinceMs: null,
  openerId: null,
});

export const seedBrowserPane = ({ state }: SeedParams): void => {
  seedActivityRunScene();
  const projectId = pinProjectOf({ state: useAppStore.getState(), sessionId: SESSION_ID });
  const tabs = [
    rowOf({
      id: 'mock-browser-checkout',
      url: 'http://localhost:5173/checkout',
      title: 'Checkout',
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
  const live = tabs.map(factsOf);
  let opened = 0;
  mockSceneIpc((command, payload) => {
    switch (command) {
      case 'browser_tab_rows_list':
        if (isProjectOwner({ payload })) {
          return pins;
        }
        return ownerSessionOf({ payload }) === ROUNDING_ID ? roundingTabs : tabs;
      case 'browser_tab_list':
        return live;
      case 'browser_tab_open':
        opened += 1;
        return factsOf({
          id: `opened-${opened}`,
          url: textOf({ payload, field: 'url' }),
          title: '',
        });
      case 'browser_tab_show':
      case 'browser_tab_hide':
        return live.find((facts) => facts.id === textOf({ payload, field: 'tabId' })) ?? live[0];
      default:
        return null;
    }
  });
  browserTabListPref.write(state === 'tabs');
  useAppStore.setState({
    browserSessionTabs: { [SESSION_ID]: tabs },
    browserActiveTab: { [SESSION_ID]: 'mock-browser-checkout' },
    browserShownPin: { [SESSION_ID]: null },
    browserLiveTabs: {
      [SESSION_ID]: Object.fromEntries(tabs.map((tab) => [tab.id, `mock-live-${tab.id}`])),
    },
    ...(projectId === null ? {} : { browserProjectPins: { [projectId]: pins } }),
  });
  if (state === 'page') {
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
