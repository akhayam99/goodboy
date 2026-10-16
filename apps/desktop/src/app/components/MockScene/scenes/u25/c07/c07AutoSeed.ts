import { brandId, type Agent, type AgentId, type AutoTreeId } from '@goodboy/types';
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
  autoSceneOf,
  type AutoSceneState,
} from '../../u24/autoSceneSeed';

export type C07Place = 'auto' | 'list' | 'start' | 'session';

export type C07Seed = Readonly<{
  state: AutoSceneState;
  place: C07Place;
}>;

export const C07_SESSION = AUTO_SESSION;

export const C07_ROOT_ID = AUTO_ROOT_ID;

const clock = sceneClock({ anchor: '2026-10-13T12:10:00.000Z' });

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

export const seedC07 = ({ state, place }: C07Seed): void => {
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
    agentTurnState: { [AUTO_ROOT_ID]: scene.rootTurn },
    transcripts: { [AUTO_ROOT_ID]: scene.events },
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
};
