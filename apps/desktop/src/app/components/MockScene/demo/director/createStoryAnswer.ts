import { nowIso } from '../../../../../store/slices/project-mounts/nowIso';
import type { AppStore } from '../../../../../store/store';
import { STORY_PLANNER_ID } from '../../scenes/story/storyWorld';
import type { DirectorStore } from './directorTypes';
import { createSimulatedAnswer } from './createSimulatedAnswer';
import { scheduleCues } from './scheduleCues';
import { storyAnswerCues } from './storyAnswerCues';

type Params = {
  readonly store: DirectorStore;
};

export const createStoryAnswer = ({ store }: Params): AppStore['answerOpenQuestions'] => {
  const send = (async (input) => {
    const agentId = input.agentId ?? STORY_PLANNER_ID;
    input.onStarted?.();
    scheduleCues({
      store,
      agentId,
      now: () => nowIso({}),
      cues: storyAnswerCues({ sessionId: input.sessionId, agentId, text: input.content }),
    });
    return { blockedOverBudget: false };
  }) satisfies AppStore['sendTurn'];
  return createSimulatedAnswer({ store, send, now: () => nowIso({}) });
};
