import {
  brandId,
  type AgentId,
  type ProviderRunId,
  type SessionId,
  type WorkflowRunId,
} from '@goodboy/types';
import type { DemoCue, DemoTimeline, DirectorStore, TimelineParams } from './directorTypes';
import { eventCue } from './eventCue';
import { appendTurnEvents } from './appendTurnEvents';
import { startAgentTurn } from './startAgentTurn';
import { finishAgentTurn } from './finishAgentTurn';
import { installRunActions } from './runActions';

const TEST_COMMAND = 'pnpm test --filter payments-api export --repeat 20';
const USAGE = {
  inputTokens: 18400,
  outputTokens: 920,
  cachedInputTokens: 12000,
  estimatedCostUsd: 0.42,
};

type Target = {
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
  readonly implementerId: AgentId;
  readonly implementRunId: ProviderRunId;
  readonly reviewerId: AgentId;
  readonly openToolUseId: string | null;
};

type StepParams = {
  readonly store: DirectorStore;
  readonly target: Target;
  readonly step: number;
};

const setCurrentStep = ({ store, target, step }: StepParams): void => {
  store.setState((current) => ({
    sessions: current.sessions.map((session) =>
      session.id === target.sessionId
        ? {
            ...session,
            workflowRuns: session.workflowRuns.map((run) =>
              run.id === target.workflowRunId ? { ...run, currentStep: step } : run,
            ),
          }
        : session,
    ),
  }));
};

const targetOf = ({ state }: TimelineParams): Target | null => {
  const sessionId = state.currentSessionId;
  if (sessionId === null) {
    return null;
  }
  const focused = state.focusedWorkflowRunId[sessionId] ?? null;
  if (focused === null) {
    return null;
  }
  const workflowRunId = brandId<WorkflowRunId>({ value: focused });
  const steps = (state.sessionPhaseRuns[sessionId] ?? [])
    .filter((agent) => agent.workflowRunId === workflowRunId)
    .sort((left, right) => left.ordinal - right.ordinal);
  const implementer = steps.find((agent) => agent.status === 'running');
  const reviewer = steps.find((agent) => agent.status === 'pending');
  if (implementer === undefined || reviewer === undefined) {
    return null;
  }
  const turn = state.agentTurnState[implementer.id];
  if (turn?.kind !== 'running') {
    return null;
  }
  const events = state.transcripts[implementer.id] ?? [];
  const started = new Set(
    events.flatMap((event) => (event.kind === 'tool_call_start' ? [event.toolUseId] : [])),
  );
  for (const event of events) {
    if (event.kind === 'tool_call_end') {
      started.delete(event.toolUseId);
    }
  }
  return {
    sessionId,
    workflowRunId,
    implementerId: implementer.id,
    implementRunId: turn.runId,
    reviewerId: reviewer.id,
    openToolUseId: [...started][0] ?? null,
  };
};

export const runTimeline = ({ state }: TimelineParams): DemoTimeline | null => {
  const target = targetOf({ state });
  if (target === null) {
    return null;
  }
  const { sessionId, implementerId, implementRunId, reviewerId } = target;
  const reviewRunId = brandId<ProviderRunId>({ value: `demo-review-${reviewerId}` });
  const openToolUseId = target.openToolUseId;
  const implement: ReadonlyArray<DemoCue> = [
    ...(openToolUseId === null
      ? []
      : [
          eventCue({
            atMs: 700,
            agentId: implementerId,
            events: ({ at }) => [
              {
                kind: 'tool_call_end',
                runId: implementRunId,
                toolUseId: openToolUseId,
                output: 'ok',
                isError: false,
                at,
              },
            ],
          }),
        ]),
    eventCue({
      atMs: 1400,
      agentId: implementerId,
      events: ({ at }) => [
        {
          kind: 'assistant_text',
          runId: implementRunId,
          delta:
            'The last batch is skipped when the row count is a multiple of 500. Flushing it after the loop.',
          at,
        },
      ],
    }),
    eventCue({
      atMs: 3000,
      agentId: implementerId,
      events: ({ at }) => [
        {
          kind: 'file_edit',
          runId: implementRunId,
          path: '/mock/payments-api/src/export/batchWriter.ts',
          editType: 'modify',
          at,
        },
      ],
    }),
    eventCue({
      atMs: 3600,
      agentId: implementerId,
      events: ({ at }) => [
        {
          kind: 'tool_call_start',
          runId: implementRunId,
          toolUseId: 'demo-run-implement-test',
          toolName: 'Bash',
          input: { command: TEST_COMMAND },
          at,
        },
      ],
    }),
    eventCue({
      atMs: 4800,
      agentId: implementerId,
      events: ({ at }) => [
        {
          kind: 'tool_call_end',
          runId: implementRunId,
          toolUseId: 'demo-run-implement-test',
          output: '20 passed',
          isError: false,
          at,
        },
        {
          kind: 'assistant_text',
          runId: implementRunId,
          delta: '20 of 20 runs pass on 12,000 rows.',
          at,
        },
      ],
    }),
    {
      atMs: 6300,
      apply: ({ store, at }) => {
        appendTurnEvents({
          store,
          agentId: implementerId,
          events: [
            { kind: 'usage', runId: implementRunId, usage: USAGE, at },
            { kind: 'done', runId: implementRunId, at },
          ],
        });
        finishAgentTurn({ store, sessionId, agentId: implementerId, at, isViewed: true });
      },
    },
  ];
  const review: ReadonlyArray<DemoCue> = [
    {
      atMs: 7100,
      apply: ({ store, at }) => {
        setCurrentStep({ store, target, step: 2 });
        store.setState((current) => ({
          selectedAgentId: { ...current.selectedAgentId, [sessionId]: reviewerId },
          agentRunHistory: { ...current.agentRunHistory, [reviewerId]: [reviewRunId] },
        }));
        appendTurnEvents({
          store,
          agentId: reviewerId,
          events: [{ kind: 'user_text', runId: reviewRunId, text: 'Check the fix.', at }],
        });
        startAgentTurn({ store, sessionId, agentId: reviewerId, runId: reviewRunId, at });
      },
    },
    eventCue({
      atMs: 7900,
      agentId: reviewerId,
      events: ({ at }) => [
        {
          kind: 'tool_call_start',
          runId: reviewRunId,
          toolUseId: 'demo-run-review-test',
          toolName: 'Bash',
          input: { command: TEST_COMMAND },
          at,
        },
      ],
    }),
    eventCue({
      atMs: 9200,
      agentId: reviewerId,
      events: ({ at }) => [
        {
          kind: 'tool_call_end',
          runId: reviewRunId,
          toolUseId: 'demo-run-review-test',
          output: '20 passed',
          isError: false,
          at,
        },
      ],
    }),
    eventCue({
      atMs: 9800,
      agentId: reviewerId,
      events: ({ at }) => [
        {
          kind: 'assistant_text',
          runId: reviewRunId,
          delta:
            '20 of 20 runs pass. The fix is correct and the new test covers a multiple of 500.',
          at,
        },
      ],
    }),
    {
      atMs: 11600,
      apply: ({ store, at }) => {
        appendTurnEvents({
          store,
          agentId: reviewerId,
          events: [
            { kind: 'usage', runId: reviewRunId, usage: USAGE, at },
            { kind: 'done', runId: reviewRunId, at },
          ],
        });
        finishAgentTurn({ store, sessionId, agentId: reviewerId, at, isViewed: true });
      },
    },
  ];
  return {
    setup: installRunActions,
    prepare: ({ store }) => {
      store.setState((current) => ({
        sessions: current.sessions.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                workflowRuns: session.workflowRuns.map((run) =>
                  run.id === target.workflowRunId && run.rulesSnapshot !== undefined
                    ? { ...run, rulesSnapshot: { ...run.rulesSnapshot, autonomy: 'plan' } }
                    : run,
                ),
              }
            : session,
        ),
      }));
    },
    cues: [...implement, ...review],
  };
};
