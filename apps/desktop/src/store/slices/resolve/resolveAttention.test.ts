import { describe, expect, it, vi } from 'vitest';
import type {
  AgentId,
  ResolveAttempt,
  ResolveFailureCause,
  ResolveThread,
  SessionId,
} from '@goodboy/types';
import { projectResolveRows } from './projectResolveRows';
import { resolveAttentionOf } from './resolveAttention';
import type { GetFn, SetFn } from './types';

const SESSION = 'session-1' as SessionId;

const thread = ({
  threadId,
  state,
  attemptId = null,
  stateReason = null,
}: {
  readonly threadId: string;
  readonly state: ResolveThread['state'];
  readonly attemptId?: string | null;
  readonly stateReason?: string | null;
}): ResolveThread =>
  ({
    id: `row-${threadId}`,
    sessionId: SESSION,
    threadId,
    state,
    stateReason,
    activeAttemptId: attemptId,
  }) as unknown as ResolveThread;

const attempt = ({
  id,
  cause,
}: {
  readonly id: string;
  readonly cause: ResolveFailureCause | null;
}): ResolveAttempt =>
  ({
    id,
    sessionId: SESSION,
    agentId: 'agent-1' as AgentId,
    threadIds: [],
    phase: 'failed',
    failureCause: cause,
  }) as unknown as ResolveAttempt;

describe('resolveAttentionOf', () => {
  it('counts the comments that wait for an answer and the ones that could not be fixed', () => {
    const attention = resolveAttentionOf({
      threads: [
        thread({ threadId: 't1', state: 'needs_answer' }),
        thread({ threadId: 't2', state: 'failed', attemptId: 'a1' }),
        thread({ threadId: 't3', state: 'fixed' }),
        thread({ threadId: 't4', state: 'working' }),
      ],
      attempts: [attempt({ id: 'a1', cause: 'provider_error' })],
    });

    expect(attention).toEqual({ needsYou: 1, couldntFix: 1 });
  });

  it('does not raise attention for a run you stopped or a push that failed', () => {
    const attention = resolveAttentionOf({
      threads: [
        thread({ threadId: 't1', state: 'failed', attemptId: 'a1' }),
        thread({
          threadId: 't2',
          state: 'failed',
          attemptId: 'a2',
          stateReason: 'publication_failed:{}',
        }),
      ],
      attempts: [attempt({ id: 'a1', cause: 'stopped' }), attempt({ id: 'a2', cause: null })],
    });

    expect(attention).toEqual({ needsYou: 0, couldntFix: 0 });
  });
});

describe('projectResolveRows notifications', () => {
  const stateWith = ({
    threads,
    emit,
  }: {
    readonly threads: ReadonlyArray<ResolveThread> | undefined;
    readonly emit: ReturnType<typeof vi.fn>;
  }) => {
    const get = (() => ({
      sessionResolveThreads: threads === undefined ? {} : { [SESSION]: threads },
      sessionResolveAttempts: {},
      emitNotification: emit,
    })) as unknown as GetFn;
    const set = vi.fn() as unknown as SetFn;
    return { get, set };
  };

  it('tells you once when a comment starts to need you', () => {
    const emit = vi.fn();
    const { get, set } = stateWith({
      threads: [thread({ threadId: 't1', state: 'working' })],
      emit,
    });

    projectResolveRows({
      set,
      get,
      sessionId: SESSION,
      rows: [thread({ threadId: 't1', state: 'needs_answer' })],
      attempts: [],
    });

    expect(emit).toHaveBeenCalledOnce();
    expect(emit.mock.calls[0]?.[0]).toMatchObject({
      title: 'A fix run needs you',
      sessionId: SESSION,
      action: { kind: 'open-activity', sessionId: SESSION },
    });
  });

  it('tells you when a comment could not be fixed', () => {
    const emit = vi.fn();
    const { get, set } = stateWith({
      threads: [thread({ threadId: 't1', state: 'working' })],
      emit,
    });

    projectResolveRows({
      set,
      get,
      sessionId: SESSION,
      rows: [thread({ threadId: 't1', state: 'failed', attemptId: 'a1' })],
      attempts: [attempt({ id: 'a1', cause: 'spend_cap' })],
    });

    expect(emit.mock.calls[0]?.[0]).toMatchObject({ title: "A fix run couldn't fix a comment" });
  });

  it('stays quiet on the first load and when nothing new needs you', () => {
    const emit = vi.fn();
    const first = stateWith({ threads: undefined, emit });
    projectResolveRows({
      set: first.set,
      get: first.get,
      sessionId: SESSION,
      rows: [thread({ threadId: 't1', state: 'needs_answer' })],
      attempts: [],
    });
    const again = stateWith({
      threads: [thread({ threadId: 't1', state: 'needs_answer' })],
      emit,
    });
    projectResolveRows({
      set: again.set,
      get: again.get,
      sessionId: SESSION,
      rows: [thread({ threadId: 't1', state: 'needs_answer' })],
      attempts: [],
    });

    expect(emit).not.toHaveBeenCalled();
  });
});
