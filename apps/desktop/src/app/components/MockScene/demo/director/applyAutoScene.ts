import type { IsoDateTime, ProviderRunId } from '@goodboy/types';
import {
  AUTO_PLAN,
  AUTO_PLAN_STORED,
  AUTO_SESSION,
  IMPLEMENTER_ID,
  autoSceneOf,
  type AutoSceneState,
} from '../../scenes/u24/autoSceneSeed';
import type { DirectorStore } from './directorTypes';

const SCENE_TURNS = 4;

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

const implementerTurnOf = ({ isRunning, at, runId }: TurnParams) =>
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
  const scene = autoSceneOf({ state });
  const sessionId = AUTO_SESSION.id;
  const isImplementing = scene.agents.some(
    (agent) => agent.id === IMPLEMENTER_ID && agent.status === 'running',
  );
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
      [IMPLEMENTER_ID]: implementerTurnOf({
        isRunning: isImplementing,
        at,
        runId: implementerRunId,
      }),
    },
    sessionPlans: {
      ...current.sessionPlans,
      [sessionId]: scene.hasPlanArtifact ? [AUTO_PLAN] : [],
    },
    sessionArtifacts: {
      ...current.sessionArtifacts,
      [sessionId]: scene.hasPlanArtifact ? [AUTO_PLAN_STORED] : [],
    },
  }));
};
