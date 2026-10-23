import type { AgentId, OpenQuestion, ProviderRunId, SessionId, TurnEvent } from '@goodboy/types';
import { landingLiveKey } from '../../../../../features/chat/reveal/landingLiveKey';
import { liveTextRegistry } from '../../../../../features/chat/reveal/liveTextRegistry';
import type { DemoCue, DemoTimeline, TimelineParams } from './directorTypes';
import { eventCue } from './eventCue';
import { appendTurnEvents } from './appendTurnEvents';
import { startAgentTurn } from './startAgentTurn';
import { finishAgentTurn } from './finishAgentTurn';

const READ_ID = 'demo-agent-read';
const TEST_ID = 'demo-agent-test';
const EDIT_START_MS = 2600;
const EDIT_GAP_MS = 650;
const TEST_MS = 1300;
const SENTENCE_GAP_MS = 1400;
const DONE_GAP_MS = 1600;
const QUESTION_GAP_MS = 700;
const DRAFT =
  'Also log the processor event id when a duplicate is skipped, so support can trace it.';
const ANSWER_REPLY =
  'Thanks, that settles it. Updating notify-relay to match, then rerunning the redelivery test.';
const REPLY =
  'Adding it now. The duplicate branch in handler.ts logs the event id at info level, and the redelivery test checks the line is written once.';

type FileEdit = Extract<TurnEvent, { kind: 'file_edit' }>;

const isFileEdit = (event: TurnEvent): event is FileEdit => event.kind === 'file_edit';

type SplitParams = {
  readonly text: string;
};

const sentencesOf = ({ text }: SplitParams): ReadonlyArray<string> =>
  text
    .split('. ')
    .map(
      (part, index, parts) =>
        `${index === 0 ? '' : ' '}${part}${index < parts.length - 1 ? '.' : ''}`,
    );

type Target = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly runId: ProviderRunId;
  readonly opening: ReadonlyArray<TurnEvent>;
  readonly edits: ReadonlyArray<FileEdit>;
  readonly closing: string;
  readonly question: OpenQuestion;
  readonly delegateIds: ReadonlySet<AgentId>;
};

const targetOf = ({ state }: TimelineParams): Target | null => {
  const sessionId = state.currentSessionId;
  if (sessionId === null) {
    return null;
  }
  const agentId = state.selectedAgentId[sessionId];
  if (agentId === null || agentId === undefined) {
    return null;
  }
  const transcript = state.transcripts[agentId] ?? [];
  const firstEdit = transcript.findIndex(isFileEdit);
  const question = (state.sessionOpenQuestions[sessionId] ?? []).find(
    (entry) => entry.isBlocking && entry.status === 'open',
  );
  const first = transcript[0];
  if (firstEdit < 0 || question === undefined || first === undefined) {
    return null;
  }
  const rest = transcript.slice(firstEdit);
  const closing = rest
    .map((event) => (event.kind === 'assistant_text' ? event.delta : ''))
    .filter((delta) => delta.length > 0)
    .join('');
  return {
    sessionId,
    agentId,
    runId: first.runId,
    opening: transcript.slice(0, firstEdit),
    edits: rest.filter(isFileEdit),
    closing,
    question,
    delegateIds: new Set(
      (state.sessionPhaseRuns[sessionId] ?? [])
        .filter((agent) => agent.sourceThreadId === question.id)
        .map((agent) => agent.id),
    ),
  };
};

export const agentTimeline = ({ state }: TimelineParams): DemoTimeline | null => {
  const target = targetOf({ state });
  if (target === null) {
    return null;
  }
  const { sessionId, agentId, runId, edits, question } = target;
  const firstPath = edits[0]?.path ?? '';
  const testAt = EDIT_START_MS + edits.length * EDIT_GAP_MS;
  const sentences = sentencesOf({ text: target.closing });
  const closingAt = testAt + TEST_MS + SENTENCE_GAP_MS / 2;
  const doneAt = closingAt + sentences.length * SENTENCE_GAP_MS + DONE_GAP_MS;
  const cues: ReadonlyArray<DemoCue> = [
    eventCue({
      atMs: 300,
      agentId,
      events: ({ at }) => [
        {
          kind: 'assistant_text',
          runId,
          delta: 'Reading the webhook handler to see where the credit is posted.',
          at,
        },
      ],
    }),
    eventCue({
      atMs: 1100,
      agentId,
      events: ({ at }) => [
        {
          kind: 'tool_call_start',
          runId,
          toolUseId: READ_ID,
          toolName: 'Read',
          input: { file_path: firstPath },
          at,
        },
      ],
    }),
    eventCue({
      atMs: 1900,
      agentId,
      events: ({ at }) => [
        { kind: 'tool_call_end', runId, toolUseId: READ_ID, output: 'ok', isError: false, at },
      ],
    }),
    ...edits.map((edit, index) =>
      eventCue({
        atMs: EDIT_START_MS + index * EDIT_GAP_MS,
        agentId,
        events: ({ at }) => [{ ...edit, at }],
      }),
    ),
    eventCue({
      atMs: testAt,
      agentId,
      events: ({ at }) => [
        {
          kind: 'tool_call_start',
          runId,
          toolUseId: TEST_ID,
          toolName: 'Bash',
          input: { command: 'pnpm test --filter payments-api webhooks' },
          at,
        },
      ],
    }),
    eventCue({
      atMs: testAt + TEST_MS,
      agentId,
      events: ({ at }) => [
        {
          kind: 'tool_call_end',
          runId,
          toolUseId: TEST_ID,
          output: 'Tests  3 passed (3)',
          isError: false,
          at,
        },
      ],
    }),
    ...sentences.map((delta, index) =>
      eventCue({
        atMs: closingAt + index * SENTENCE_GAP_MS,
        agentId,
        events: ({ at }) => [{ kind: 'assistant_text', runId, delta, at }],
      }),
    ),
    {
      atMs: doneAt,
      apply: ({ store, at }) => {
        appendTurnEvents({ store, agentId, events: [{ kind: 'done', runId, at }] });
        finishAgentTurn({ store, sessionId, agentId, at, isViewed: true });
      },
    },
    {
      atMs: doneAt + QUESTION_GAP_MS,
      apply: ({ store, at }) => {
        liveTextRegistry.mark({ runId: landingLiveKey({ scope: 'questions', id: sessionId }) });
        store.setState((current) => ({
          sessionOpenQuestions: {
            ...current.sessionOpenQuestions,
            [sessionId]: [
              ...(current.sessionOpenQuestions[sessionId] ?? []),
              { ...question, createdAt: at },
            ],
          },
        }));
      },
    },
  ];
  return {
    setup: ({ store }) => {
      store.setState((current) => ({ agentDraft: { ...current.agentDraft, [agentId]: DRAFT } }));
    },
    reply: REPLY,
    answerReply: ANSWER_REPLY,
    prepare: ({ store, at }) => {
      store.setState((current) => ({
        transcripts: { ...current.transcripts, [agentId]: target.opening },
        sessionOpenQuestions: {
          ...current.sessionOpenQuestions,
          [sessionId]: (current.sessionOpenQuestions[sessionId] ?? []).filter(
            (entry) => entry.id !== question.id,
          ),
        },
        sessionPhaseRuns: {
          ...current.sessionPhaseRuns,
          [sessionId]: (current.sessionPhaseRuns[sessionId] ?? []).filter(
            (agent) => !target.delegateIds.has(agent.id),
          ),
        },
      }));
      startAgentTurn({ store, sessionId, agentId, runId, at });
    },
    cues,
  };
};
