import { brandId, type ProviderRunId, type TurnEvent } from '@goodboy/types';
import { agentPlace } from '../../../../../store';
import { nowIso } from '../../../../../store/slices/project-mounts/nowIso';
import type { AppStore } from '../../../../../store/store';
import { STORY_PLANNER } from '../../scenes/story/storyContent';
import { STORY_PLANNER_ID, STORY_ROOT_ID, STORY_SESSION_ID } from '../../scenes/story/storyWorld';
import { appendTurnEvents } from './appendTurnEvents';
import type { DirectorStore } from './directorTypes';
import { installDemoWorld } from './installDemoWorld';
import { installPlanCommentPrefill } from './installPlanCommentPrefill';
import { scheduleCues } from './scheduleCues';
import { startAgentTurn } from './startAgentTurn';
import { storyRevisionCues } from './storyRevisionCues';
import { storyWorkCues } from './storyWorkCues';

const APPROVAL_PREFIX = 'Approved plan v';

type Params = {
  readonly store: DirectorStore;
};

type RunParams = {
  readonly label: string;
};

const runOf = ({ label }: RunParams): ProviderRunId =>
  brandId<ProviderRunId>({ value: `demo-story-${label}-${crypto.randomUUID()}` });

export const installStoryPlan = ({ store }: Params): void => {
  installDemoWorld({ store });
  installPlanCommentPrefill();
  const simulatedSend = store.getState().sendTurn;
  const sendTurn = (async (input) => {
    if (input.sessionId !== STORY_SESSION_ID) {
      return simulatedSend(input);
    }
    if (input.agentId === STORY_ROOT_ID && input.content.startsWith(APPROVAL_PREFIX)) {
      const rootRun = runOf({ label: 'approved' });
      const at = nowIso({});
      const event: TurnEvent = { kind: 'user_text', runId: rootRun, text: input.content, at };
      appendTurnEvents({ store, agentId: STORY_ROOT_ID, events: [event] });
      startAgentTurn({
        store,
        sessionId: STORY_SESSION_ID,
        agentId: STORY_ROOT_ID,
        runId: rootRun,
        at,
      });
      store.getState().navigate({
        to: agentPlace({ sessionId: STORY_SESSION_ID, agentId: STORY_ROOT_ID }),
        drawer: { kind: 'spawned', sessionId: STORY_SESSION_ID, payload: null },
      });
      input.onStarted?.();
      scheduleCues({
        store,
        cues: storyWorkCues({ rootRun }),
        now: () => nowIso({}),
        agentId: STORY_ROOT_ID,
      });
      return { blockedOverBudget: false };
    }
    if (input.agentId === STORY_PLANNER_ID) {
      const runId = runOf({ label: 'revision' });
      input.onStarted?.();
      scheduleCues({
        store,
        agentId: STORY_PLANNER_ID,
        now: () => nowIso({}),
        cues: storyRevisionCues({
          sessionId: input.sessionId,
          agentId: STORY_PLANNER_ID,
          text: input.content,
          runId,
          onDone: () =>
            input.onSettled?.({
              runId,
              assistantText: STORY_PLANNER.revision,
              hasFailed: false,
              wasCancelled: false,
              filesTouched: [],
            }),
        }),
      });
      return { blockedOverBudget: false };
    }
    return simulatedSend(input);
  }) satisfies AppStore['sendTurn'];
  store.setState({ sendTurn });
};
