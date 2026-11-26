import type { AutoDelegation } from '@goodboy/db';
import type { AgentId, ProviderRunId } from '@goodboy/types';
import { STORY_SESSION_ID } from '../../scenes/story/storyWorld';
import { autoSceneOf } from '../../scenes/u24/autoSceneSeed';
import { addAgent } from './addAgent';
import { appendTurnEvents } from './appendTurnEvents';
import { castAutoScene } from './castAutoScene';
import type { DemoCue } from './directorTypes';
import { eventCue } from './eventCue';
import { finishAgentTurn } from './finishAgentTurn';
import { patchAutoView } from './patchAutoView';
import { startAgentTurn } from './startAgentTurn';
import { storyToolCues } from './storyToolCues';
import { textCues } from './textCues';
import { textCuesEndMs } from './textCuesEndMs';

const THINK_MS = 1000;
const TOOL_GAP_MS = 100;
const TOOL_MS = 400;
const EDIT_GAP_MS = 100;
const EDIT_STEP_MS = 250;
const DONE_GAP_MS = 150;

type ToolParams = {
  readonly command: string;
  readonly output: string;
};

type Params = {
  readonly atMs: number;
  readonly agentId: AgentId;
  readonly runId: ProviderRunId;
  readonly task: string;
  readonly note: string;
  readonly tool: ToolParams;
  readonly edits: ReadonlyArray<string>;
};

type Result = {
  readonly cues: ReadonlyArray<DemoCue>;
  readonly endMs: number;
};

type UpsertParams = {
  readonly delegations: ReadonlyArray<AutoDelegation>;
  readonly next: AutoDelegation;
};

const upsertOf = ({ delegations, next }: UpsertParams): ReadonlyArray<AutoDelegation> =>
  delegations.some((entry) => entry.childAgentId === next.childAgentId)
    ? delegations.map((entry) => (entry.childAgentId === next.childAgentId ? next : entry))
    : [...delegations, next];

export const storyHelperCues = ({
  atMs,
  agentId,
  runId,
  task,
  note,
  tool,
  edits,
}: Params): Result => {
  const working = castAutoScene({ scene: autoSceneOf({ state: 'working' }) });
  const finished = castAutoScene({ scene: autoSceneOf({ state: 'done' }) });
  const agent = working.agents.find((entry) => entry.id === agentId);
  const running = working.view.delegations.find((entry) => entry.childAgentId === agentId);
  const settled = finished.view.delegations.find((entry) => entry.childAgentId === agentId);
  const noteAt = atMs + THINK_MS;
  const toolAt = textCuesEndMs({ atMs: noteAt, text: note }) + TOOL_GAP_MS;
  const editAt = toolAt + TOOL_MS + EDIT_GAP_MS;
  const doneAt = editAt + edits.length * EDIT_STEP_MS + DONE_GAP_MS;
  const cues: ReadonlyArray<DemoCue> = [
    {
      atMs,
      apply: ({ store, at }) => {
        if (agent !== undefined) {
          addAgent({ store, sessionId: STORY_SESSION_ID, agent: { ...agent, status: 'pending' } });
        }
        if (running !== undefined) {
          patchAutoView({
            store,
            sessionId: STORY_SESSION_ID,
            patch: ({ view }) => ({
              ...view,
              delegations: upsertOf({ delegations: view.delegations, next: running }),
            }),
          });
        }
        appendTurnEvents({
          store,
          agentId,
          events: [{ kind: 'user_text', runId, text: task, at }],
        });
        startAgentTurn({ store, sessionId: STORY_SESSION_ID, agentId, runId, at });
      },
    },
    ...textCues({ atMs: noteAt, agentId, runId, text: note }),
    ...storyToolCues({
      startMs: toolAt,
      endMs: toolAt + TOOL_MS,
      agentId,
      runId,
      command: tool.command,
      output: tool.output,
    }),
    ...edits.map((path, index) =>
      eventCue({
        atMs: editAt + index * EDIT_STEP_MS,
        agentId,
        events: ({ at }) => [{ kind: 'file_edit', runId, path, editType: 'modify', at }],
      }),
    ),
    {
      atMs: doneAt,
      apply: ({ store, at }) => {
        appendTurnEvents({ store, agentId, events: [{ kind: 'done', runId, at }] });
        finishAgentTurn({ store, sessionId: STORY_SESSION_ID, agentId, at, isViewed: false });
        if (settled !== undefined) {
          patchAutoView({
            store,
            sessionId: STORY_SESSION_ID,
            patch: ({ view }) => ({
              ...view,
              delegations: upsertOf({ delegations: view.delegations, next: settled }),
            }),
          });
        }
      },
    },
  ];
  return { cues, endMs: doneAt };
};
