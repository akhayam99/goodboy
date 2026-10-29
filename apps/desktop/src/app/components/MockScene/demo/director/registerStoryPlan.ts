import type { ProviderRunId } from '@goodboy/types';
import { storyPlanOf, storyPlanStoredOf } from '../../scenes/story/storyPlan';
import { STORY_SESSION_ID } from '../../scenes/story/storyWorld';
import { applyAutoScene } from './applyAutoScene';
import type { CueParams } from './directorTypes';

type Params = CueParams & {
  readonly runId: ProviderRunId;
};

export const registerStoryPlan = ({ store, at, runId }: Params): void => {
  store.setState((current) => ({
    sessionPlans: {
      ...current.sessionPlans,
      [STORY_SESSION_ID]: [storyPlanOf({ revision: 1, at })],
    },
    sessionArtifacts: {
      ...current.sessionArtifacts,
      [STORY_SESSION_ID]: [storyPlanStoredOf({ revision: 1, at, runId })],
    },
  }));
  applyAutoScene({ store, state: 'plan', at, implementerRunId: runId, revision: 1 });
};
