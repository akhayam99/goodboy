import type { AgentId, ProviderRunId, SessionId, TurnEvent } from '@goodboy/types';
import type { DemoCue } from './directorTypes';
import { eventCue } from './eventCue';
import { appendTurnEvents } from './appendTurnEvents';
import { finishAgentTurn } from './finishAgentTurn';

const TEST_COMMAND = 'pnpm test --filter payments-api export --repeat 20';
const USAGE = {
  inputTokens: 18400,
  outputTokens: 920,
  cachedInputTokens: 12000,
  estimatedCostUsd: 0.42,
};

export type RunStepRole = 'implement' | 'review' | 'other';

type Params = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly runId: ProviderRunId;
  readonly role: RunStepRole;
};

type ToolParams = {
  readonly runId: ProviderRunId;
  readonly toolUseId: string;
};

type AtParams = {
  readonly at: TurnEvent['at'];
};

const testStart =
  ({ runId, toolUseId }: ToolParams) =>
  ({ at }: AtParams): ReadonlyArray<TurnEvent> => [
    {
      kind: 'tool_call_start',
      runId,
      toolUseId,
      toolName: 'Bash',
      input: { command: TEST_COMMAND },
      at,
    },
  ];

const testEnd =
  ({ runId, toolUseId }: ToolParams) =>
  ({ at }: AtParams): ReadonlyArray<TurnEvent> => [
    { kind: 'tool_call_end', runId, toolUseId, output: '20 passed', isError: false, at },
  ];

const TEXTS: Readonly<Record<RunStepRole, ReadonlyArray<string>>> = {
  implement: [
    'The last batch is skipped when the row count is a multiple of 500. Flushing it after the loop.',
    '20 of 20 runs pass on 12,000 rows.',
  ],
  review: [
    'Read the batching change and reran the export suite.',
    '20 of 20 runs pass. The fix is correct and the new test covers a multiple of 500.',
  ],
  other: [
    'Read the step brief and the files it names.',
    'Done. The result is in this step for you to read.',
  ],
};

export const runStepCues = ({
  sessionId,
  agentId,
  runId,
  role,
}: Params): ReadonlyArray<DemoCue> => {
  const toolUseId = `demo-run-${role}-${runId}`;
  const [opening = '', closing = ''] = TEXTS[role];
  return [
    eventCue({
      atMs: 900,
      agentId,
      events: ({ at }) => [{ kind: 'assistant_text', runId, delta: opening, at }],
    }),
    ...(role === 'implement'
      ? [
          eventCue({
            atMs: 2400,
            agentId,
            events: ({ at }) => [
              {
                kind: 'file_edit',
                runId,
                path: '/mock/payments-api/src/export/batchWriter.ts',
                editType: 'modify',
                at,
              },
            ],
          }),
        ]
      : []),
    eventCue({ atMs: 3200, agentId, events: testStart({ runId, toolUseId }) }),
    eventCue({ atMs: 4600, agentId, events: testEnd({ runId, toolUseId }) }),
    eventCue({
      atMs: 5200,
      agentId,
      events: ({ at }) => [{ kind: 'assistant_text', runId, delta: ` ${closing}`, at }],
    }),
    {
      atMs: 6400,
      apply: ({ store, at }) => {
        appendTurnEvents({
          store,
          agentId,
          events: [
            { kind: 'usage', runId, usage: USAGE, at },
            { kind: 'done', runId, at },
          ],
        });
        finishAgentTurn({ store, sessionId, agentId, at, isViewed: true });
      },
    },
  ];
};
