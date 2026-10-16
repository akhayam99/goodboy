import {
  brandId,
  type Agent,
  type AgentId,
  type AutoTreeId,
  type ProviderRunId,
  type TurnEvent,
} from '@goodboy/types';
import { agentPlace, useAppStore } from '../../../../../../store';
import { lensPlace } from '../../../../../../store/slices/navigation/canonicalLocation';
import type { AutoTreeView } from '../../../../../../store/slices/auto-view/state';
import { SETTING_AUTO_EXPERIMENT } from '../../../../../../features/settings/settings';
import { sceneClock } from '../../../sceneClock';
import { seedActivityRunScene } from '../../activityRunSeed';
import {
  AUTO_PLAN,
  AUTO_PLAN_STORED,
  AUTO_ROOT_ID,
  AUTO_SESSION,
  IMPLEMENTER_ID,
  TESTER_ID,
  autoSceneOf,
  type AutoSceneState,
} from '../../u24/autoSceneSeed';

export type C07Place = 'auto' | 'list' | 'start' | 'session';

export type C07Seed = Readonly<{
  state: AutoSceneState;
  place: C07Place;
  pane?: 'implementer' | 'tester';
}>;

const clock = sceneClock({ anchor: '2026-10-13T12:21:00.000Z' });

const CHILD_START = '2026-10-13T12:09:16.000Z';

const RUN_CHILD = brandId<ProviderRunId>({ value: 'mock-auto-child-run' });

type ChildTextParams = {
  readonly time: string;
  readonly brief: string;
  readonly answer: string | null;
};

const childEventsOf = ({ time, brief, answer }: ChildTextParams): ReadonlyArray<TurnEvent> => {
  const at = clock.iso({ at: `2026-10-13T${time}.000Z` });
  const asked: TurnEvent = {
    kind: 'user_text',
    runId: RUN_CHILD,
    text: brief,
    at,
    deliveredBy: 'auto',
  };
  if (answer === null) {
    return [asked];
  }
  const answered: TurnEvent = { kind: 'assistant_text', runId: RUN_CHILD, delta: answer, at };
  return [asked, answered];
};

const CHILD_EVENTS = {
  implementer: childEventsOf({
    time: '12:09:16',
    brief:
      'Build the credit key once per retry in postCredit, then make applyCredit reject a repeated key.',
    answer: null,
  }),
  tester: childEventsOf({
    time: '12:11:56',
    brief: 'Test the retry path with a timeout on the first attempt.',
    answer: 'Three tests added in payments-api, all pass.',
  }),
} as const;

const CHILD_ID = { implementer: IMPLEMENTER_ID, tester: TESTER_ID } as const;

const EARLIER_ROOT_ID = brandId<AgentId>({ value: 'mock-auto-root-earlier' });

const EARLIER_ROOT: Agent = {
  id: EARLIER_ROOT_ID,
  sessionId: AUTO_SESSION.id,
  ordinal: -1,
  name: 'Find why the notify-relay webhook retries twice',
  status: 'completed',
  kind: 'auto',
  startedAt: clock.iso({ at: '2026-10-13T10:02:00.000Z' }),
  completedAt: clock.iso({ at: '2026-10-13T10:09:00.000Z' }),
  lastFinishedAt: clock.iso({ at: '2026-10-13T10:09:00.000Z' }),
  lastViewedAt: clock.iso({ at: '2026-10-13T10:10:00.000Z' }),
};

type EarlierParams = {
  readonly view: AutoTreeView;
};

const earlierViewOf = ({ view }: EarlierParams): AutoTreeView => ({
  ...view,
  tree: {
    ...view.tree,
    id: brandId<AutoTreeId>({ value: 'mock-auto-tree-earlier' }),
    rootAgentId: EARLIER_ROOT_ID,
    phase: 'finished',
  },
  delegations: [],
  artifacts: [],
  pendingRefusal: null,
});

type ViewsParams = {
  readonly place: C07Place;
  readonly view: AutoTreeView;
};

const viewsOf = ({ place, view }: ViewsParams): ReadonlyArray<AutoTreeView> => {
  if (place === 'start') {
    return [];
  }
  return place === 'list' ? [view, earlierViewOf({ view })] : [view];
};

type AgentsParams = {
  readonly place: C07Place;
  readonly agents: ReadonlyArray<Agent>;
};

const agentsOf = ({ place, agents }: AgentsParams): ReadonlyArray<Agent> => {
  if (place === 'start') {
    return [];
  }
  return place === 'list' ? [...agents, EARLIER_ROOT] : agents;
};

export const seedC07 = ({ state, place, pane }: C07Seed): void => {
  const { navigate, openExternalTaskLens } = useAppStore.getState();
  seedActivityRunScene();
  const scene = autoSceneOf({ state });
  useAppStore.setState((current) => ({
    navigate,
    openExternalTaskLens,
    sessionPhaseRuns: { [AUTO_SESSION.id]: agentsOf({ place, agents: scene.agents }) },
    agentKindOverride: { [AUTO_ROOT_ID]: 'auto', [EARLIER_ROOT_ID]: 'auto' },
    agentProviderOverride: { [AUTO_ROOT_ID]: 'anthropic', [EARLIER_ROOT_ID]: 'anthropic' },
    agentModelOverride: { [AUTO_ROOT_ID]: 'opus-5.5', [EARLIER_ROOT_ID]: 'opus-5.5' },
    agentEffortOverride: { [AUTO_ROOT_ID]: 'medium' },
    autoTreeViews: { [AUTO_SESSION.id]: viewsOf({ place, view: scene.view }) },
    loadAutoTrees: async () => undefined,
    agentTurnState: {
      [AUTO_ROOT_ID]: scene.rootTurn,
      [IMPLEMENTER_ID]:
        state === 'working'
          ? { kind: 'running', runId: RUN_CHILD, startedAt: clock.iso({ at: CHILD_START }) }
          : { kind: 'idle', lastActivityAt: clock.iso({ at: CHILD_START }) },
    },
    transcripts: {
      [AUTO_ROOT_ID]: scene.events,
      [IMPLEMENTER_ID]: CHILD_EVENTS.implementer,
      [TESTER_ID]: CHILD_EVENTS.tester,
    },
    loadAgentTranscript: async () => undefined,
    sessionPlans: { [AUTO_SESSION.id]: scene.hasPlanArtifact ? [AUTO_PLAN] : [] },
    sessionArtifacts: { [AUTO_SESSION.id]: scene.hasPlanArtifact ? [AUTO_PLAN_STORED] : [] },
    sessionOpenQuestions: { [AUTO_SESSION.id]: [] },
    sessionAnsweredQuestions: { [AUTO_SESSION.id]: [] },
    settings: { ...current.settings, [SETTING_AUTO_EXPERIMENT]: 'true' },
    loadSetting: async () => 'true',
  }));
  const store = useAppStore.getState();
  if (place === 'auto' || place === 'session') {
    store.navigate({ to: agentPlace({ sessionId: AUTO_SESSION.id, agentId: AUTO_ROOT_ID }) });
  }
  if (place === 'list' || place === 'start') {
    store.navigate({ to: lensPlace({ state: store, sessionId: AUTO_SESSION.id, lens: 'auto' }) });
  }
  if (place === 'session') {
    useAppStore.getState().pickSidebarLevel({ level: 'session' });
  }
  if (pane !== undefined) {
    useAppStore.getState().openDrawer({
      kind: 'auto-child',
      sessionId: AUTO_SESSION.id,
      payload: { agentId: CHILD_ID[pane] },
    });
  }
};
