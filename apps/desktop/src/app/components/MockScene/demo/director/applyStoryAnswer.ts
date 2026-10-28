import { wrapOpenQuestionAnswers } from '@goodboy/core';
import { useAppStore } from '../../../../../store';
import { nowIso } from '../../../../../store/slices/project-mounts/nowIso';
import { STORY_QUESTION } from '../../scenes/story/storyContent';
import { STORY_PLANNER_ID, STORY_SESSION_ID } from '../../scenes/story/storyWorld';
import { storyAnswerCues } from './storyAnswerCues';

export const applyStoryAnswer = (): void => {
  const at = nowIso({});
  const asked = useAppStore.getState().sessionOpenQuestions[STORY_SESSION_ID] ?? [];
  useAppStore.setState((current) => ({
    sessionOpenQuestions: { ...current.sessionOpenQuestions, [STORY_SESSION_ID]: [] },
    sessionAnsweredQuestions: {
      ...current.sessionAnsweredQuestions,
      [STORY_SESSION_ID]: asked.map((question) => ({
        ...question,
        status: 'answered',
        userAnswer: STORY_QUESTION.recommended,
        answerSource: 'user',
        answeredAt: at,
        answerDeliveredAt: at,
      })),
    },
  }));
  const text = wrapOpenQuestionAnswers(
    `Answers to open questions:\n\n- Q: ${STORY_QUESTION.text}\n  A: ${STORY_QUESTION.recommended}`,
  );
  for (const cue of storyAnswerCues({
    sessionId: STORY_SESSION_ID,
    agentId: STORY_PLANNER_ID,
    text,
  })) {
    cue.apply({ store: useAppStore, at: nowIso({}), hint: () => undefined });
  }
};
