import { describe, expect, it } from 'vitest';
import type { Agent, AgentId, OpenQuestion, OpenQuestionId, SessionId } from '@goodboy/types';
import {
  canDelegateQuestion,
  clipQuestionText,
  composeDelegateKickoff,
  delegateAgentName,
  delegateRowState,
  isQuestionDelegate,
  latestQuestionDelegate,
  liveQuestionDelegate,
  partitionDelegatedQuestions,
} from './questionDelegate';

const SESSION_ID = 'session-1' as SessionId;
const QUESTION_ID = 'oq-1' as OpenQuestionId;

type AgentPatch = Omit<Partial<Agent>, 'id'> & { readonly id: string };

const agent = (overrides: AgentPatch): Agent =>
  ({
    sessionId: SESSION_ID,
    ordinal: 0,
    name: 'scout',
    status: 'running',
    ...overrides,
    id: overrides.id as AgentId,
  }) as Agent;

const delegate = (overrides: AgentPatch): Agent =>
  agent({ sourceKind: 'open_question', sourceThreadId: QUESTION_ID, ...overrides });

describe('questionDelegate identity', () => {
  it('reads a delegate off its source kind, never off its name', () => {
    expect(isQuestionDelegate({ agent: delegate({ id: 'a', name: 'whatever' }) })).toBe(true);
    expect(isQuestionDelegate({ agent: agent({ id: 'b', name: 'answer: something' }) })).toBe(
      false,
    );
  });

  it('names the child after the question it answers, clipped', () => {
    const long = 'should the migration run before or after the cutover window closes on friday';
    expect(delegateAgentName({ questionText: 'pick a database' })).toBe('answer: pick a database');
    expect(delegateAgentName({ questionText: long }).length).toBeLessThanOrEqual(
      'answer: '.length + 48,
    );
  });

  it('flattens newlines when it clips', () => {
    expect(clipQuestionText({ text: '  pick a\n  database  ' })).toBe('pick a database');
  });
});

describe('questionDelegate lookup', () => {
  it('takes the newest live delegate for the question, ignoring other questions', () => {
    const agents = [
      delegate({ id: 'd1', ordinal: 0, status: 'failed' }),
      delegate({ id: 'd2', ordinal: 1, status: 'running' }),
      delegate({ id: 'other', ordinal: 2, sourceThreadId: 'oq-2', status: 'running' }),
    ];
    expect(liveQuestionDelegate({ agents, questionId: QUESTION_ID })?.id).toBe('d2');
    expect(latestQuestionDelegate({ agents, questionId: QUESTION_ID })?.id).toBe('d2');
  });

  it('reports no live delegate once every one of them has settled', () => {
    const agents = [
      delegate({ id: 'd1', ordinal: 0, status: 'completed' }),
      delegate({ id: 'd2', ordinal: 1, status: 'failed' }),
    ];
    expect(liveQuestionDelegate({ agents, questionId: QUESTION_ID })).toBeNull();
    expect(latestQuestionDelegate({ agents, questionId: QUESTION_ID })?.id).toBe('d2');
  });
});

describe('delegateRowState', () => {
  it('offers delegation when nothing has been handed over yet', () => {
    expect(delegateRowState({ asker: null, delegate: null, isChosen: false })).toBe('available');
  });

  it('marks the row chosen while the panel is staged', () => {
    expect(delegateRowState({ asker: null, delegate: null, isChosen: true })).toBe('chosen');
  });

  it('shows a live delegate as running, even when the draft still says agent', () => {
    expect(
      delegateRowState({
        asker: null,
        delegate: delegate({ id: 'd1', status: 'running' }),
        isChosen: true,
      }),
    ).toBe('running');
  });

  it('offers a retry once the delegate failed', () => {
    expect(
      delegateRowState({
        asker: null,
        delegate: delegate({ id: 'd1', status: 'failed' }),
        isChosen: false,
      }),
    ).toBe('retry');
  });

  it('blocks a second layer: a delegated agent cannot delegate again', () => {
    const asker = delegate({ id: 'parent-delegate', status: 'running' });
    expect(canDelegateQuestion({ asker })).toBe(false);
    expect(delegateRowState({ asker, delegate: null, isChosen: false })).toBe('blocked');
  });
});

describe('composeDelegateKickoff', () => {
  it('asks for one answer block and forbids the fan-out markers', () => {
    const kickoff = composeDelegateKickoff({ questionText: 'pick a database', hints: '' });
    expect(kickoff).toContain('pick a database');
    expect(kickoff).toContain('`<<oq-answer>>`');
    expect(kickoff).toContain('`<<fan-out>>`');
    expect(kickoff).toContain('`<<ctx-question>>`');
    expect(kickoff).toContain('last layer');
  });

  it('carries the hints only when the user wrote some', () => {
    expect(composeDelegateKickoff({ questionText: 'q', hints: '   ' })).not.toContain(
      'Hints from the user',
    );
    expect(composeDelegateKickoff({ questionText: 'q', hints: 'weigh the cost' })).toContain(
      '**Hints from the user** weigh the cost',
    );
  });
});

describe('partitionDelegatedQuestions', () => {
  const question = (id: string): OpenQuestion =>
    ({ id: id as OpenQuestionId, text: id, status: 'open' }) as OpenQuestion;

  it('holds back only the questions a live delegate is answering', () => {
    const questions = [question('oq-1'), question('oq-2')];
    const agents = [delegate({ id: 'd1', status: 'running' })];

    const { waiting, answerable } = partitionDelegatedQuestions({ questions, agents });

    expect(waiting.map((entry) => entry.id)).toEqual(['oq-1']);
    expect(answerable.map((entry) => entry.id)).toEqual(['oq-2']);
  });

  it('gives a question back once its delegate has settled', () => {
    const questions = [question('oq-1')];
    const agents = [delegate({ id: 'd1', status: 'failed' })];

    const { waiting, answerable } = partitionDelegatedQuestions({ questions, agents });

    expect(waiting).toHaveLength(0);
    expect(answerable).toHaveLength(1);
  });
});
