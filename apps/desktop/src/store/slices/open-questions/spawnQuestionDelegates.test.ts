import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Agent, AgentId, OpenQuestion, OpenQuestionId, SessionId } from '@goodboy/types';
import { spawnQuestionDelegates, type QuestionDelegateRequest } from './spawnQuestionDelegates';
import type { GetFn } from './types';

const SESSION_ID = 'session-1' as SessionId;
const ASKER_ID = 'asker-1' as AgentId;

const question = (id: string, text: string): OpenQuestion =>
  ({
    id: id as OpenQuestionId,
    sessionId: SESSION_ID,
    text,
    suggestedAnswers: [],
    isBlocking: true,
    userAnswer: null,
    status: 'open',
    createdByAgentId: ASKER_ID,
    createdAt: '2026-09-21T00:00:00.000Z',
  }) as unknown as OpenQuestion;

const asker: Agent = {
  id: ASKER_ID,
  sessionId: SESSION_ID,
  ordinal: 0,
  name: 'plan the work',
  status: 'running',
  workflowRunId: 'run-1',
} as unknown as Agent;

const request = (q: OpenQuestion, hints = ''): QuestionDelegateRequest => ({
  question: q,
  hints,
  provider: 'anthropic',
  model: 'sonnet-5',
  effort: 'medium',
});

type Harness = {
  readonly state: {
    sessionPhaseRuns: Record<string, ReadonlyArray<Agent>>;
    spawnAgent: ReturnType<typeof vi.fn>;
    emitNotification: ReturnType<typeof vi.fn>;
  };
  readonly run: ReturnType<typeof spawnQuestionDelegates>;
};

const createHarness = ({ agents }: { readonly agents: ReadonlyArray<Agent> }): Harness => {
  const state = {
    sessionPhaseRuns: { [SESSION_ID]: agents },
    spawnAgent: vi.fn(async () => 'child-1' as AgentId),
    emitNotification: vi.fn(async () => undefined),
  };
  const get = (() => state) as unknown as GetFn;
  return { state, run: spawnQuestionDelegates(get) };
};

beforeEach(() => vi.clearAllMocks());

describe('spawnQuestionDelegates', () => {
  it('links the child to the asker and to the question, as a scout that steals no focus', async () => {
    const { state, run } = createHarness({ agents: [asker] });

    const outcomes = await run({
      sessionId: SESSION_ID,
      requests: [request(question('oq-1', 'pick a database'), 'weigh the cost')],
    });

    expect(outcomes).toEqual([{ questionId: 'oq-1', agentId: 'child-1', kind: 'spawned' }]);
    expect(state.spawnAgent).toHaveBeenCalledTimes(1);
    const [sessionId, args] = state.spawnAgent.mock.calls[0] as [
      SessionId,
      Record<string, unknown>,
    ];
    expect(sessionId).toBe(SESSION_ID);
    expect(args).toMatchObject({
      kindOverride: 'scout',
      sourceKind: 'open_question',
      sourceThreadId: 'oq-1',
      parentAgentId: ASKER_ID,
      workflowRunId: 'run-1',
      provider: 'anthropic',
      model: 'sonnet-5',
      effort: 'medium',
      focus: 'none',
    });
    expect(args['stepId']).toBeUndefined();
    expect(args['name']).toBe('answer: pick a database');
    expect(String(args['initialPrompt'])).toContain('weigh the cost');
  });

  it('leaves the run id off when the asker is standalone', async () => {
    const standalone = { ...asker, workflowRunId: undefined } as Agent;
    const { state, run } = createHarness({ agents: [standalone] });

    await run({ sessionId: SESSION_ID, requests: [request(question('oq-1', 'pick a database'))] });

    const [, args] = state.spawnAgent.mock.calls[0] as [SessionId, Record<string, unknown>];
    expect(args['workflowRunId']).toBeUndefined();
  });

  it('refuses a second layer when the asker is itself a delegate', async () => {
    const delegateAsker = {
      ...asker,
      sourceKind: 'open_question',
      sourceThreadId: 'oq-0',
    } as Agent;
    const { state, run } = createHarness({ agents: [delegateAsker] });

    const outcomes = await run({
      sessionId: SESSION_ID,
      requests: [request(question('oq-1', 'pick a database'))],
    });

    expect(outcomes).toEqual([{ questionId: 'oq-1', agentId: null, kind: 'refused' }]);
    expect(state.spawnAgent).not.toHaveBeenCalled();
    expect(state.emitNotification).toHaveBeenCalled();
  });

  it('stays idempotent while a live delegate already answers that question', async () => {
    const live = {
      id: 'child-0' as AgentId,
      sessionId: SESSION_ID,
      ordinal: 1,
      name: 'answer: pick a database',
      status: 'running',
      sourceKind: 'open_question',
      sourceThreadId: 'oq-1',
      parentAgentId: ASKER_ID,
    } as unknown as Agent;
    const { state, run } = createHarness({ agents: [asker, live] });

    const outcomes = await run({
      sessionId: SESSION_ID,
      requests: [request(question('oq-1', 'pick a database'))],
    });

    expect(outcomes).toEqual([{ questionId: 'oq-1', agentId: 'child-0', kind: 'already-running' }]);
    expect(state.spawnAgent).not.toHaveBeenCalled();
  });

  it('hands over again once the previous delegate has failed', async () => {
    const failed = {
      id: 'child-0' as AgentId,
      sessionId: SESSION_ID,
      ordinal: 1,
      name: 'answer: pick a database',
      status: 'failed',
      sourceKind: 'open_question',
      sourceThreadId: 'oq-1',
      parentAgentId: ASKER_ID,
    } as unknown as Agent;
    const { state, run } = createHarness({ agents: [asker, failed] });

    const outcomes = await run({
      sessionId: SESSION_ID,
      requests: [request(question('oq-1', 'pick a database'))],
    });

    expect(outcomes[0]?.kind).toBe('spawned');
    expect(state.spawnAgent).toHaveBeenCalledTimes(1);
  });

  it('spawns each delegated question with its own model and hints', async () => {
    const { state, run } = createHarness({ agents: [asker] });
    state.spawnAgent
      .mockResolvedValueOnce('child-1' as AgentId)
      .mockResolvedValueOnce('child-2' as AgentId);

    await run({
      sessionId: SESSION_ID,
      requests: [
        { ...request(question('oq-1', 'pick a database'), 'weigh the cost'), model: 'sonnet-5' },
        {
          ...request(question('oq-2', 'pick a queue'), 'favour boring tech'),
          provider: 'codex',
          model: 'gpt-6-sol',
          effort: 'high',
        },
      ],
    });

    expect(state.spawnAgent).toHaveBeenCalledTimes(2);
    const [, first] = state.spawnAgent.mock.calls[0] as [SessionId, Record<string, unknown>];
    const [, second] = state.spawnAgent.mock.calls[1] as [SessionId, Record<string, unknown>];
    expect(first).toMatchObject({ model: 'sonnet-5', effort: 'medium' });
    expect(String(first['initialPrompt'])).toContain('weigh the cost');
    expect(second).toMatchObject({ provider: 'codex', model: 'gpt-6-sol', effort: 'high' });
    expect(String(second['initialPrompt'])).toContain('favour boring tech');
  });

  it('reports a failed spawn without taking the others down with it', async () => {
    const { state, run } = createHarness({ agents: [asker] });
    state.spawnAgent
      .mockRejectedValueOnce(new Error('provider unavailable'))
      .mockResolvedValueOnce('child-2' as AgentId);

    const outcomes = await run({
      sessionId: SESSION_ID,
      requests: [
        request(question('oq-1', 'pick a database')),
        request(question('oq-2', 'pick a queue')),
      ],
    });

    expect(outcomes).toEqual([
      { questionId: 'oq-1', agentId: null, kind: 'failed' },
      { questionId: 'oq-2', agentId: 'child-2', kind: 'spawned' },
    ]);
    expect(state.emitNotification).toHaveBeenCalled();
  });
});
