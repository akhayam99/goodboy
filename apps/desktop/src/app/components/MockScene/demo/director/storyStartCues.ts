import { STORY_PLANNER } from '../../scenes/story/storyContent';
import {
  STORY_BRIEF,
  STORY_PLANNER_ID,
  STORY_PLANNER_RUN,
  STORY_ROOT_ID,
  STORY_ROOT_RUN,
  STORY_SESSION_ID,
  storyQuestionOf,
} from '../../scenes/story/storyWorld';
import { autoSceneOf } from '../../scenes/u24/autoSceneSeed';
import { addAgent } from './addAgent';
import { appendTurnEvents } from './appendTurnEvents';
import { AUTO_STORY } from './autoStory';
import { castAutoScene } from './castAutoScene';
import type { DemoCue } from './directorTypes';
import { finishAgentTurn } from './finishAgentTurn';
import { followAgent } from './followAgent';
import { idleAgentTurn } from './idleAgentTurn';
import { patchAutoView } from './patchAutoView';
import { patchDelegationState } from './patchDelegationState';
import { startAgentTurn } from './startAgentTurn';
import { storyToolCues } from './storyToolCues';
import { textCues } from './textCues';
import { textCuesEndMs } from './textCuesEndMs';

const LEAD_THINK_AT_MS = 400;
const LEAD_TEXT_AT_MS = 1600;
const HANDOFF_GAP_MS = 200;
const PLANNER_GAP_MS = 400;
const PLANNER_THINK_MS = 1200;
const TOOL_MS = 800;
const INTRO_GAP_MS = 100;
const QUESTION_GAP_MS = 1200;

const PLANNER_MODEL = { provider: 'anthropic', model: 'claude-opus-5-5' } as const;

export const storyStartCues = (): ReadonlyArray<DemoCue> => {
  const scene = castAutoScene({ scene: autoSceneOf({ state: 'delegating' }) });
  const planner = scene.agents.find((agent) => agent.id === STORY_PLANNER_ID);
  const delegations = scene.view.delegations.filter(
    (delegation) => delegation.childAgentId === STORY_PLANNER_ID,
  );
  const handoffAt =
    textCuesEndMs({ atMs: LEAD_TEXT_AT_MS, text: AUTO_STORY.first }) + HANDOFF_GAP_MS;
  const plannerAt = handoffAt + PLANNER_GAP_MS;
  const toolAt = plannerAt + PLANNER_THINK_MS;
  const introAt = toolAt + TOOL_MS + INTRO_GAP_MS;
  const questionAt = textCuesEndMs({ atMs: introAt, text: STORY_PLANNER.intro }) + QUESTION_GAP_MS;
  return [
    {
      atMs: LEAD_THINK_AT_MS,
      apply: ({ store, at }) => {
        startAgentTurn({
          store,
          sessionId: STORY_SESSION_ID,
          agentId: STORY_ROOT_ID,
          runId: STORY_ROOT_RUN,
          at,
        });
      },
    },
    ...textCues({
      atMs: LEAD_TEXT_AT_MS,
      agentId: STORY_ROOT_ID,
      runId: STORY_ROOT_RUN,
      text: AUTO_STORY.first,
    }),
    {
      atMs: handoffAt,
      apply: ({ store, at }) => {
        appendTurnEvents({
          store,
          agentId: STORY_ROOT_ID,
          events: [{ kind: 'done', runId: STORY_ROOT_RUN, at }],
        });
        idleAgentTurn({ store, sessionId: STORY_SESSION_ID, agentId: STORY_ROOT_ID, at });
        if (planner === undefined) {
          return;
        }
        addAgent({
          store,
          sessionId: STORY_SESSION_ID,
          agent: {
            ...planner,
            status: 'pending',
            providerOverride: PLANNER_MODEL.provider,
            modelOverride: PLANNER_MODEL.model,
          },
        });
        patchAutoView({
          store,
          sessionId: STORY_SESSION_ID,
          patch: ({ view }) => ({ ...view, delegations }),
        });
      },
    },
    {
      atMs: plannerAt,
      apply: ({ store, at }) => {
        appendTurnEvents({
          store,
          agentId: STORY_PLANNER_ID,
          events: [
            {
              kind: 'user_text',
              runId: STORY_PLANNER_RUN,
              text: STORY_BRIEF,
              provider: PLANNER_MODEL.provider,
              model: PLANNER_MODEL.model,
              at,
            },
          ],
        });
        startAgentTurn({
          store,
          sessionId: STORY_SESSION_ID,
          agentId: STORY_PLANNER_ID,
          runId: STORY_PLANNER_RUN,
          at,
        });
        patchDelegationState({
          store,
          sessionId: STORY_SESSION_ID,
          childAgentId: STORY_PLANNER_ID,
          state: 'running',
        });
        followAgent({ store, from: STORY_ROOT_ID, to: STORY_PLANNER_ID });
      },
    },
    ...storyToolCues({
      startMs: toolAt,
      endMs: toolAt + TOOL_MS,
      agentId: STORY_PLANNER_ID,
      runId: STORY_PLANNER_RUN,
      command: STORY_PLANNER.command,
      output: STORY_PLANNER.output,
    }),
    ...textCues({
      atMs: introAt,
      agentId: STORY_PLANNER_ID,
      runId: STORY_PLANNER_RUN,
      text: STORY_PLANNER.intro,
    }),
    {
      atMs: questionAt,
      apply: ({ store, at }) => {
        appendTurnEvents({
          store,
          agentId: STORY_PLANNER_ID,
          events: [{ kind: 'done', runId: STORY_PLANNER_RUN, at }],
        });
        finishAgentTurn({
          store,
          sessionId: STORY_SESSION_ID,
          agentId: STORY_PLANNER_ID,
          at,
          isViewed: true,
        });
        patchDelegationState({
          store,
          sessionId: STORY_SESSION_ID,
          childAgentId: STORY_PLANNER_ID,
          state: 'paused',
        });
        store.setState((current) => ({
          sessionOpenQuestions: {
            ...current.sessionOpenQuestions,
            [STORY_SESSION_ID]: [storyQuestionOf({ at })],
          },
        }));
      },
    },
  ];
};
