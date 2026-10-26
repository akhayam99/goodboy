import type { IsoDateTime, ProviderRunId } from '@goodboy/types';
import {
  AUTO_PLAN,
  AUTO_PLAN_STORED,
  AUTO_SESSION,
  IMPLEMENTER_ID,
  TESTER_ID,
  autoSceneOf,
  type AutoSceneState,
} from '../../scenes/u24/autoSceneSeed';
import { AUTO_STORY, LEDGER_ID } from './autoStory';
import { castAutoScene } from './castAutoScene';
import type { DirectorStore } from './directorTypes';

const SCENE_TURNS = 4;

const STORY_PLAN = { ...AUTO_PLAN, bodyMd: AUTO_STORY.planBody };
const STORY_PLAN_STORED = { ...AUTO_PLAN_STORED, sourceText: AUTO_STORY.planBody };

type Params = {
  readonly store: DirectorStore;
  readonly state: AutoSceneState;
  readonly at: IsoDateTime;
  readonly implementerRunId: ProviderRunId;
};

type TurnParams = {
  readonly isRunning: boolean;
  readonly at: IsoDateTime;
  readonly runId: ProviderRunId;
};

const helperTurnOf = ({ isRunning, at, runId }: TurnParams) =>
  isRunning
    ? { kind: 'running' as const, runId, startedAt: at }
    : { kind: 'idle' as const, lastActivityAt: at };

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

type ResultParams = {
  readonly result: unknown;
};

const settledResultOf = ({ result }: ResultParams): unknown => {
  if (!isRecord(result) || !isRecord(result.verified)) {
    return result;
  }
  const { publish: _publish, remote: _remote, ...verified } = result.verified;
  return { ...result, verified };
};

export const applyAutoScene = ({ store, state, at, implementerRunId }: Params): void => {
  const scene = castAutoScene({ scene: autoSceneOf({ state }) });
  const sessionId = AUTO_SESSION.id;
  const isImplementing = scene.agents.some(
    (agent) => agent.id === IMPLEMENTER_ID && agent.status === 'running',
  );
  const turn = helperTurnOf({ isRunning: isImplementing, at, runId: implementerRunId });
  store.setState((current) => ({
    sessionPhaseRuns: { ...current.sessionPhaseRuns, [sessionId]: scene.agents },
    autoTreeViews: {
      ...current.autoTreeViews,
      [sessionId]: [
        {
          ...scene.view,
          tree: { ...scene.view.tree, turnsUsed: SCENE_TURNS },
          delegations: scene.view.delegations.map((delegation) => ({
            ...delegation,
            result: settledResultOf({ result: delegation.result }),
          })),
        },
      ],
    },
    agentTurnState: {
      ...current.agentTurnState,
      [IMPLEMENTER_ID]: turn,
      [TESTER_ID]: turn,
      [LEDGER_ID]: turn,
    },
    sessionPlans: {
      ...current.sessionPlans,
      [sessionId]: scene.hasPlanArtifact ? [STORY_PLAN] : [],
    },
    sessionArtifacts: {
      ...current.sessionArtifacts,
      [sessionId]: scene.hasPlanArtifact ? [STORY_PLAN_STORED] : [],
    },
  }));
};
