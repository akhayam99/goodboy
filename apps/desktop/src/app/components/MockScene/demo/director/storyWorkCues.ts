import { brandId, type ProviderRunId } from '@goodboy/types';
import { STORY_PLANNER, STORY_REVIEW, STORY_RUN } from '../../scenes/story/storyContent';
import { STORY_ROOT_ID, STORY_SESSION_ID } from '../../scenes/story/storyWorld';
import { IMPLEMENTER_ID, TESTER_ID, autoSceneOf } from '../../scenes/u24/autoSceneSeed';
import { applyAutoScene, storySceneViewOf } from './applyAutoScene';
import { appendTurnEvents } from './appendTurnEvents';
import { AUTO_STORY } from './autoStory';
import { castAutoScene } from './castAutoScene';
import type { DemoCue } from './directorTypes';
import { finishAgentTurn } from './finishAgentTurn';
import { followAgent } from './followAgent';
import { patchAutoView } from './patchAutoView';
import { startAgentTurn } from './startAgentTurn';
import { storyHelperCues } from './storyHelperCues';
import { textCues } from './textCues';
import { textCuesEndMs } from './textCuesEndMs';

const LEAD_AT_MS = 1000;
const HELPER_GAP_MS = 100;
const FINAL_THINK_MS = 500;
const FINAL_SPAN_MS = 1000;
const FINISH_GAP_MS = 200;

type RunParams = {
  readonly label: string;
};

const runOf = ({ label }: RunParams): ProviderRunId =>
  brandId<ProviderRunId>({ value: `demo-story-${label}-${crypto.randomUUID()}` });

type Params = {
  readonly rootRun: ProviderRunId;
};

export const storyWorkCues = ({ rootRun }: Params): ReadonlyArray<DemoCue> => {
  const implementerRun = runOf({ label: 'implementer' });
  const finalRun = runOf({ label: 'final' });
  const approved = storySceneViewOf({
    scene: castAutoScene({ scene: autoSceneOf({ state: 'working' }) }),
    revision: 2,
  });
  const implementer = storyHelperCues({
    atMs: textCuesEndMs({ atMs: LEAD_AT_MS, text: AUTO_STORY.third }) + HELPER_GAP_MS,
    from: STORY_ROOT_ID,
    agentId: IMPLEMENTER_ID,
    runId: implementerRun,
    task: AUTO_STORY.implementerTask,
    note: AUTO_STORY.implementerNote,
    tool: { command: STORY_PLANNER.command, output: STORY_PLANNER.output },
    edits: STORY_RUN.changedFiles,
  });
  const tester = storyHelperCues({
    atMs: implementer.endMs + HELPER_GAP_MS,
    from: IMPLEMENTER_ID,
    agentId: TESTER_ID,
    runId: runOf({ label: 'tester' }),
    task: AUTO_STORY.testerTask,
    note: AUTO_STORY.testerNote,
    tool: { command: STORY_REVIEW.testCommand, output: STORY_REVIEW.testOutput },
    edits: [],
  });
  const finalAt = tester.endMs + HELPER_GAP_MS;
  const finalTextAt = finalAt + FINAL_THINK_MS;
  const finishAt =
    textCuesEndMs({ atMs: finalTextAt, text: AUTO_STORY.final, maxSpanMs: FINAL_SPAN_MS }) +
    FINISH_GAP_MS;
  return [
    {
      atMs: 0,
      apply: ({ store }) => {
        patchAutoView({
          store,
          sessionId: STORY_SESSION_ID,
          patch: ({ view }) => ({ ...view, tree: approved.tree, artifacts: approved.artifacts }),
        });
      },
    },
    ...textCues({
      atMs: LEAD_AT_MS,
      agentId: STORY_ROOT_ID,
      runId: rootRun,
      text: AUTO_STORY.third,
    }),
    ...implementer.cues,
    ...tester.cues,
    {
      atMs: finalAt,
      apply: ({ store, at }) => {
        appendTurnEvents({
          store,
          agentId: STORY_ROOT_ID,
          events: [{ kind: 'done', runId: rootRun, at }],
        });
        startAgentTurn({
          store,
          sessionId: STORY_SESSION_ID,
          agentId: STORY_ROOT_ID,
          runId: finalRun,
          at,
        });
        followAgent({ store, from: TESTER_ID, to: STORY_ROOT_ID });
      },
    },
    ...textCues({
      atMs: finalTextAt,
      agentId: STORY_ROOT_ID,
      runId: finalRun,
      text: AUTO_STORY.final,
      isParagraph: true,
      maxSpanMs: FINAL_SPAN_MS,
    }),
    {
      atMs: finishAt,
      apply: ({ store, at }) => {
        applyAutoScene({ store, state: 'done', at, implementerRunId: implementerRun, revision: 2 });
        appendTurnEvents({
          store,
          agentId: STORY_ROOT_ID,
          events: [{ kind: 'done', runId: finalRun, at }],
        });
        finishAgentTurn({
          store,
          sessionId: STORY_SESSION_ID,
          agentId: STORY_ROOT_ID,
          at,
          isViewed: true,
        });
      },
    },
  ];
};
