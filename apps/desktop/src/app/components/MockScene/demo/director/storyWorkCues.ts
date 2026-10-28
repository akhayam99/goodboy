import { brandId, type AgentId, type ProviderRunId } from '@goodboy/types';
import { IMPLEMENTER_ID, TESTER_ID } from '../../scenes/u24/autoSceneSeed';
import { STORY_ROOT_ID, STORY_SESSION_ID } from '../../scenes/story/storyWorld';
import type { DemoCue } from './directorTypes';
import { AUTO_STORY } from './autoStory';
import { applyAutoScene } from './applyAutoScene';
import { finishAgentTurn } from './finishAgentTurn';
import { startAgentTurn } from './startAgentTurn';
import { textCues } from './textCues';
import { textCuesEndMs } from './textCuesEndMs';

const LEAD_AT_MS = 600;
const NOTE_GAP_MS = 500;
const AFTER_LEAD_MS = 300;
const AFTER_NOTES_MS = 1500;
const FINAL_GAP_MS = 400;
const FINISH_GAP_MS = 600;

type RunParams = {
  readonly label: string;
};

const runOf = ({ label }: RunParams): ProviderRunId =>
  brandId<ProviderRunId>({ value: `demo-story-${label}-${crypto.randomUUID()}` });

type NoteParams = {
  readonly agentId: AgentId;
  readonly runId: ProviderRunId;
  readonly text: string;
};

type Params = {
  readonly rootRun: ProviderRunId;
};

export const storyWorkCues = ({ rootRun }: Params): ReadonlyArray<DemoCue> => {
  const implementerRun = runOf({ label: 'implementer' });
  const finalRun = runOf({ label: 'final' });
  const noteAt = textCuesEndMs({ atMs: LEAD_AT_MS, text: AUTO_STORY.third }) + AFTER_LEAD_MS;
  const notes: ReadonlyArray<NoteParams> = [
    { agentId: IMPLEMENTER_ID, runId: implementerRun, text: AUTO_STORY.implementerNote },
    { agentId: TESTER_ID, runId: runOf({ label: 'tester' }), text: AUTO_STORY.testerNote },
  ];
  const doneAt =
    Math.max(
      ...notes.map((note, index) =>
        textCuesEndMs({ atMs: noteAt + index * NOTE_GAP_MS, text: note.text }),
      ),
    ) + AFTER_NOTES_MS;
  return [
    {
      atMs: 0,
      apply: ({ store, at }) => {
        applyAutoScene({
          store,
          state: 'working',
          at,
          implementerRunId: implementerRun,
          revision: 2,
        });
        startAgentTurn({
          store,
          sessionId: STORY_SESSION_ID,
          agentId: STORY_ROOT_ID,
          runId: rootRun,
          at,
        });
      },
    },
    ...textCues({
      atMs: LEAD_AT_MS,
      agentId: STORY_ROOT_ID,
      runId: rootRun,
      text: AUTO_STORY.third,
    }),
    ...notes.flatMap((note, index) =>
      textCues({
        atMs: noteAt + index * NOTE_GAP_MS,
        agentId: note.agentId,
        runId: note.runId,
        text: note.text,
      }),
    ),
    {
      atMs: doneAt,
      apply: ({ store, at }) => {
        applyAutoScene({ store, state: 'done', at, implementerRunId: implementerRun, revision: 2 });
        startAgentTurn({
          store,
          sessionId: STORY_SESSION_ID,
          agentId: STORY_ROOT_ID,
          runId: finalRun,
          at,
        });
      },
    },
    ...textCues({
      atMs: doneAt + FINAL_GAP_MS,
      agentId: STORY_ROOT_ID,
      runId: finalRun,
      text: AUTO_STORY.final,
      isParagraph: true,
    }),
    {
      atMs: textCuesEndMs({ atMs: doneAt + FINAL_GAP_MS, text: AUTO_STORY.final }) + FINISH_GAP_MS,
      apply: ({ store, at }) => {
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
