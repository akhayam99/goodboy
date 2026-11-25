import { MAX_TEXT_LENGTH } from './actionLimits';
import type { DecideAction, DecideKind } from './decideAction';
import { decideKindOf } from './decideAction';

type FieldSpec = 'id' | 'text' | 'int' | 'number' | ReadonlyArray<string>;

const MAX_ID_LENGTH = 128;

const RUN_STATES = ['running', 'paused', 'waiting', 'stopped', 'done', 'failed'] as const;

const AGENT_STATES = ['running', 'waiting', 'stopped', 'done', 'failed'] as const;

const SHAPES = {
  answerQuestion: { questionId: 'id', seenVersion: 'id', text: 'text' },
  approvePlan: { planId: 'id', seenPlanVersion: 'int' },
  requestPlanChanges: { planId: 'id', seenPlanVersion: 'int', text: 'text' },
  answerPermission: {
    agentId: 'id',
    requestId: 'id',
    seenInputHash: 'id',
    verdict: ['allow', 'deny'],
  },
  raiseLimit: { runId: 'id', seenLimit: 'number', offeredAmount: 'number' },
  undoRaiseLimit: { runId: 'id', raisedActionId: 'id' },
  stopRun: { runId: 'id', seenState: RUN_STATES },
  continueRun: { runId: 'id', seenState: RUN_STATES },
  stopAgent: { agentId: 'id', seenState: AGENT_STATES },
  continueAgent: { agentId: 'id', seenState: AGENT_STATES },
  answerSlackReply: {
    verdict: ['send', 'discard'],
    draftId: 'id',
    seenVersion: 'id',
    text: 'text',
  },
} as const satisfies Record<DecideKind, Readonly<Record<string, FieldSpec>>>;

type FieldParams = {
  readonly value: unknown;
  readonly spec: FieldSpec;
};

const isFieldValid = ({ value, spec }: FieldParams): boolean => {
  if (Array.isArray(spec)) {
    return typeof value === 'string' && spec.includes(value);
  }
  if (spec === 'id') {
    return typeof value === 'string' && value.length > 0 && value.length <= MAX_ID_LENGTH;
  }
  if (spec === 'text') {
    return typeof value === 'string' && value.length <= MAX_TEXT_LENGTH;
  }
  if (spec === 'int') {
    return typeof value === 'number' && Number.isInteger(value);
  }
  return typeof value === 'number' && Number.isFinite(value);
};

type ParseParams = {
  readonly raw: unknown;
};

export const parseDecideAction = ({ raw }: ParseParams): DecideAction | null => {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const record: Record<string, unknown> = { ...raw };
  const kind = decideKindOf({ kind: typeof record.kind === 'string' ? record.kind : '' });
  if (kind === null) {
    return null;
  }
  const base: Readonly<Record<string, FieldSpec>> = {
    actionId: 'id',
    workspaceId: 'id',
    sessionId: 'id',
  };
  const specs: Readonly<Record<string, FieldSpec>> = { ...base, ...SHAPES[kind] };
  for (const [name, spec] of Object.entries(specs)) {
    if (!isFieldValid({ value: record[name], spec })) {
      return null;
    }
  }
  const picked: Record<string, unknown> = { kind };
  for (const name of Object.keys(specs)) {
    picked[name] = record[name];
  }
  return picked as DecideAction;
};
