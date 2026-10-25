import type { AgentId, ProviderRunId, SessionId, TurnEvent } from '@goodboy/types';
import type { DemoCue, DirectorStore } from './directorTypes';
import { appendTurnEvents } from './appendTurnEvents';
import { eventCue } from './eventCue';
import { finishAgentTurn } from './finishAgentTurn';
import { patchAgent } from './patchAgent';
import { patchResolveThreads } from './patchResolveThreads';
import { RESOLVE_REPLY_DRAFT } from './resolveReplyDraft';

const SUMMARY =
  'retryPolicy.ts now uses the shared MAX_RETRY_ATTEMPTS and emits a metric when it gives up. The retry suite passes, and a reply is drafted for the thread.';
const TEST_COMMAND = 'pnpm vitest run retryPolicy';
const FIX_SHA = 'a4c19e07d2b85f3e61c0d9a7b42e8f15c3d6a90b';

type Params = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly runId: ProviderRunId;
  readonly attemptId: string;
  readonly threadIds: ReadonlyArray<string>;
};

type SettleParams = Params & {
  readonly store: DirectorStore;
};

const settleFix = ({ store, sessionId, agentId, attemptId, threadIds }: SettleParams): void => {
  const now = Date.now();
  const wanted = new Set(threadIds);
  const state = store.getState();
  const items = (state.sessionResolveQueueItems[sessionId] ?? []).filter((entry) =>
    wanted.has(entry.thread.threadId),
  );
  const base = state.sessionResolveCandidates[sessionId]?.[0]?.candidate;
  const candidateId = `demo-candidate-${attemptId}`;
  patchResolveThreads({
    store,
    sessionId,
    threadIds,
    patch: (thread) => ({
      ...thread,
      state: 'fixed',
      stage: 'proposed',
      disposition: 'fix',
      replyDraft: RESOLVE_REPLY_DRAFT,
      commitShas: [FIX_SHA],
      updatedAt: now,
    }),
  });
  store.setState((current) => ({
    sessionResolveAttempts: {
      ...current.sessionResolveAttempts,
      [sessionId]: (current.sessionResolveAttempts[sessionId] ?? []).map((attempt) =>
        attempt.id === attemptId ? { ...attempt, phase: 'finished', endedAt: now } : attempt,
      ),
    },
    ...(base === undefined
      ? {}
      : {
          sessionResolveCandidates: {
            ...current.sessionResolveCandidates,
            [sessionId]: [
              ...(current.sessionResolveCandidates[sessionId] ?? []),
              {
                candidate: {
                  ...base,
                  id: candidateId,
                  candidateSha: FIX_SHA,
                  state: 'ready' as const,
                  integratedSha: null,
                  createdAt: now,
                  updatedAt: now,
                },
                items: items.map((entry) => ({
                  candidateId,
                  queueItemId: entry.item.id,
                  itemRevision: entry.item.candidateRevision,
                })),
              },
            ],
          },
        }),
  }));
  patchAgent({ store, sessionId, agentId, patch: { outputSummary: SUMMARY } });
};

type ToolParams = {
  readonly runId: ProviderRunId;
  readonly toolUseId: string;
};

type AtParams = {
  readonly at: TurnEvent['at'];
};

const bash =
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

export const resolveFixCues = ({
  sessionId,
  agentId,
  runId,
  attemptId,
  threadIds,
}: Params): ReadonlyArray<DemoCue> => {
  const toolUseId = `demo-resolve-test-${runId}`;
  return [
    eventCue({
      atMs: 900,
      agentId,
      events: ({ at }) => [
        {
          kind: 'assistant_text',
          runId,
          delta:
            'retryPolicy.ts keeps its own copy of the cap. Pointing it at the shared constant.',
          at,
        },
      ],
    }),
    eventCue({
      atMs: 2200,
      agentId,
      events: ({ at }) => [
        { kind: 'file_edit', runId, path: 'src/webhooks/metrics.ts', editType: 'modify', at },
        { kind: 'file_edit', runId, path: 'src/webhooks/retryPolicy.ts', editType: 'modify', at },
      ],
    }),
    eventCue({ atMs: 3200, agentId, events: bash({ runId, toolUseId }) }),
    eventCue({
      atMs: 4600,
      agentId,
      events: ({ at }) => [
        { kind: 'tool_call_end', runId, toolUseId, output: '6 passed', isError: false, at },
      ],
    }),
    eventCue({
      atMs: 5200,
      agentId,
      events: ({ at }) => [{ kind: 'assistant_text', runId, delta: `\n\n${SUMMARY}`, at }],
    }),
    {
      atMs: 6400,
      apply: ({ store, at }) => {
        appendTurnEvents({ store, agentId, events: [{ kind: 'done', runId, at }] });
        settleFix({ store, sessionId, agentId, runId, attemptId, threadIds });
        finishAgentTurn({ store, sessionId, agentId, at, isViewed: true });
      },
    },
  ];
};
