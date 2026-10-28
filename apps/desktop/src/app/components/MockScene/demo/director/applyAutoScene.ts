import type { IsoDateTime, ProviderRunId } from '@goodboy/types';
import { isRecord } from '@goodboy/types/helpers';
import {
  IMPLEMENTER_ID,
  TESTER_ID,
  autoSceneOf,
  type AutoSceneData,
  type AutoSceneState,
} from '../../scenes/u24/autoSceneSeed';
import { STORY_PLAN } from '../../scenes/story/storyContent';
import { STORY_SESSION_ID } from '../../scenes/story/storyWorld';
import { castAutoScene } from './castAutoScene';
import type { DirectorStore } from './directorTypes';

const SCENE_TURNS = 4;

type Params = {
  readonly store: DirectorStore;
  readonly state: AutoSceneState;
  readonly at: IsoDateTime;
  readonly implementerRunId: ProviderRunId;
  readonly revision: 1 | 2;
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

type SceneParams = {
  readonly scene: AutoSceneData;
  readonly revision: 1 | 2;
};

export const storySceneViewOf = ({ scene, revision }: SceneParams): AutoSceneData['view'] => ({
  ...scene.view,
  tree: { ...scene.view.tree, turnsUsed: SCENE_TURNS },
  artifacts: scene.view.artifacts.map((row) => ({
    ...row,
    title: STORY_PLAN.title,
    revision,
    artifact: {
      ...row.artifact,
      approvedRevision: row.artifact.approvedRevision === null ? null : revision,
    },
  })),
  delegations: scene.view.delegations.map((delegation) => ({
    ...delegation,
    result: settledResultOf({ result: delegation.result }),
  })),
});

export const applyAutoScene = ({ store, state, at, implementerRunId, revision }: Params): void => {
  const scene = castAutoScene({ scene: autoSceneOf({ state }) });
  const isImplementing = scene.agents.some(
    (agent) => agent.id === IMPLEMENTER_ID && agent.status === 'running',
  );
  const turn = helperTurnOf({ isRunning: isImplementing, at, runId: implementerRunId });
  store.setState((current) => ({
    sessionPhaseRuns: {
      ...current.sessionPhaseRuns,
      [STORY_SESSION_ID]: scene.agents.map((agent) => {
        const kept = (current.sessionPhaseRuns[STORY_SESSION_ID] ?? []).find(
          (entry) => entry.id === agent.id,
        );
        return kept?.providerOverride === undefined
          ? agent
          : {
              ...agent,
              providerOverride: kept.providerOverride,
              modelOverride: kept.modelOverride,
            };
      }),
    },
    autoTreeViews: {
      ...current.autoTreeViews,
      [STORY_SESSION_ID]: [storySceneViewOf({ scene, revision })],
    },
    agentTurnState: {
      ...current.agentTurnState,
      [IMPLEMENTER_ID]: turn,
      [TESTER_ID]: turn,
    },
  }));
};
