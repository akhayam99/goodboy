// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  brandId,
  type Agent,
  type IsoDateTime,
  type OpenQuestion,
  type ProviderRunId,
  type TurnState,
} from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import { agentStateOf } from './agentStateOf';

const AT = brandId<IsoDateTime>({ value: '2026-10-24T09:00:00.000Z' });
const RUN = brandId<ProviderRunId>({ value: 'run-harborline' });

const agentOf = (overrides: Partial<Agent> = {}): Agent =>
  anAgent({ name: 'Implementer', status: 'pending', ...overrides });

const QUESTION = {
  id: brandId({ value: 'question-1' }),
  sessionId: anAgent().sessionId,
  text: 'Which width matters most?',
  suggestedAnswers: [],
  isBlocking: true,
  userAnswer: null,
  status: 'open',
  createdAt: AT,
} satisfies OpenQuestion;

type TurnKind = TurnState['kind'] | 'none';

const turnOf = (kind: TurnKind): TurnState | null => {
  switch (kind) {
    case 'none':
      return null;
    case 'running':
      return { kind: 'running', runId: RUN, startedAt: AT };
    case 'blocked':
      return { kind: 'blocked', runId: RUN, blockedAt: AT };
    case 'idle':
      return { kind: 'idle', lastActivityAt: AT };
    case 'starting':
      return { kind: 'starting', startedAt: AT };
    case 'error':
      return { kind: 'error', message: 'the provider exited', failedAt: AT };
    case 'ended':
      return { kind: 'ended', endedAt: AT };
    case 'draft':
      return { kind: 'draft' };
    default: {
      const unreachable: never = kind;
      return unreachable;
    }
  }
};

type Row = readonly [
  status: Agent['status'],
  turn: TurnKind,
  isAsking: boolean,
  expected: {
    readonly phase: string;
    readonly word: string;
    readonly node: string;
    readonly label: string;
    readonly dot: string;
    readonly isFinished?: boolean;
  },
];

const TABLE: ReadonlyArray<Row> = [
  [
    'running',
    'running',
    false,
    { phase: 'running', word: 'Running', node: 'running', label: 'Running', dot: 'running' },
  ],
  [
    'running',
    'blocked',
    false,
    {
      phase: 'waiting',
      word: 'Needs permission',
      node: 'approval',
      label: 'Needs permission',
      dot: 'needsYou',
    },
  ],
  [
    'pending',
    'blocked',
    false,
    {
      phase: 'waiting',
      word: 'Needs permission',
      node: 'approval',
      label: 'Needs permission',
      dot: 'needsYou',
    },
  ],
  [
    'completed',
    'blocked',
    false,
    {
      phase: 'waiting',
      word: 'Needs permission',
      node: 'approval',
      label: 'Needs permission',
      dot: 'needsYou',
    },
  ],
  [
    'running',
    'blocked',
    true,
    { phase: 'waiting', word: 'Needs you', node: 'question', label: 'Needs you', dot: 'needsYou' },
  ],
  [
    'running',
    'none',
    true,
    { phase: 'waiting', word: 'Needs you', node: 'question', label: 'Needs you', dot: 'needsYou' },
  ],
  [
    'completed',
    'none',
    true,
    { phase: 'waiting', word: 'Needs you', node: 'question', label: 'Needs you', dot: 'needsYou' },
  ],
  [
    'completed',
    'running',
    false,
    { phase: 'running', word: 'Running', node: 'running', label: 'Running', dot: 'running' },
  ],
  [
    'running',
    'idle',
    false,
    { phase: 'running', word: 'Running', node: 'running', label: 'Running', dot: 'running' },
  ],
  [
    'failed',
    'blocked',
    false,
    { phase: 'failed', word: 'Failed', node: 'failed', label: 'Failed', dot: 'failed' },
  ],
  [
    'blocked',
    'none',
    false,
    { phase: 'waiting', word: 'Blocked', node: 'approval', label: 'Blocked', dot: 'needsYou' },
  ],
  [
    'stopped',
    'none',
    false,
    {
      phase: 'waiting',
      word: 'Stopped, Continue',
      node: 'stopped',
      label: 'Stopped by you',
      dot: 'stopped',
      isFinished: false,
    },
  ],
  [
    'completed',
    'none',
    false,
    {
      phase: 'done',
      word: 'Done',
      node: 'done',
      label: 'Done',
      dot: 'done',
      isFinished: true,
    },
  ],
  [
    'pending',
    'none',
    false,
    { phase: 'queued', word: 'Pending', node: 'queued', label: 'Not started', dot: 'idle' },
  ],
];

describe('agentStateOf', () => {
  it.each(TABLE)('reads %s with a %s turn and asking %s', (status, turn, isAsking, expected) => {
    const state = agentStateOf({
      agent: agentOf({ status }),
      turn: turnOf(turn),
      openQuestions: isAsking ? [QUESTION] : [],
    });

    expect(state.row.phase).toBe(expected.phase);
    expect(state.word).toBe(expected.word);
    expect(state.node).toEqual({ state: expected.node, label: expected.label });
    expect(state.dot).toBe(expected.dot);
    if (expected.isFinished !== undefined) {
      expect(state.isFinished).toBe(expected.isFinished);
    }
  });

  it('files an agent the person closed as finished, whatever turn it had', () => {
    const state = agentStateOf({
      agent: agentOf({ status: 'stopped', doneAt: AT }),
      turn: turnOf('blocked'),
      openQuestions: [],
    });

    expect(state.row.phase).toBe('closed');
    expect(state.isFinished).toBe(true);
    expect(state.dot).toBe('stopped');
  });

  it('keeps the permission wait free of any answer button', () => {
    const state = agentStateOf({
      agent: agentOf({ status: 'running' }),
      turn: turnOf('blocked'),
      openQuestions: [],
    });

    expect(state.row.reason).toEqual({ kind: 'needsApproval' });
    expect(state.row.ask).toBeNull();
  });
});
