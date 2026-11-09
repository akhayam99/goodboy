import { nowIso } from '../../../../../store/slices/project-mounts/nowIso';
import type { AppStore } from '../../../../../store/store';
import { STORY_QUESTION } from '../../scenes/story/storyContent';
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
    const answer =
      (store.getState().sessionAnsweredQuestions[input.sessionId] ?? []).at(-1)?.userAnswer ??
      STORY_QUESTION.recommended;
    input.onStarted?.();
    scheduleCues({
      store,
      agentId,
      now: () => nowIso({}),
      cues: storyAnswerCues({ sessionId: input.sessionId, agentId, text: input.content, answer }),
    });
    return { blockedOverBudget: false };
  }) satisfies AppStore['sendTurn'];
  return createSimulatedAnswer({ store, send, now: () => nowIso({}) });
};
