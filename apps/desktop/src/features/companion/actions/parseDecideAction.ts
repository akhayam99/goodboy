import type { AgentState, RunState } from '../contract/projections';
import { MAX_TEXT_LENGTH } from './actionLimits';
import type { DecideAction } from './decideAction';

const MAX_ID_LENGTH = 128;

const RUN_STATES: ReadonlyArray<RunState> = [
  'running',
  'paused',
  'waiting',
  'stopped',
  'done',
  'failed',
];

const AGENT_STATES: ReadonlyArray<AgentState> = ['running', 'waiting', 'stopped', 'done', 'failed'];

type NameParams = {
  readonly name: string;
};

type PickParams<Option extends string> = {
  readonly name: string;
  readonly options: ReadonlyArray<Option>;
};

type Reader = {
  readonly id: (params: NameParams) => string | null;
  readonly text: (params: NameParams) => string | null;
  readonly int: (params: NameParams) => number | null;
  readonly number: (params: NameParams) => number | null;
  readonly pick: <Option extends string>(params: PickParams<Option>) => Option | null;
};

type ReaderParams = {
  readonly record: Readonly<Record<string, unknown>>;
};

const readerOf = ({ record }: ReaderParams): Reader => ({
  id: ({ name }) => {
    const value = record[name];
    return typeof value === 'string' && value.length > 0 && value.length <= MAX_ID_LENGTH
      ? value
      : null;
  },
  text: ({ name }) => {
    const value = record[name];
    return typeof value === 'string' && value.length <= MAX_TEXT_LENGTH ? value : null;
  },
  int: ({ name }) => {
    const value = record[name];
    return typeof value === 'number' && Number.isInteger(value) ? value : null;
  },
  number: ({ name }) => {
    const value = record[name];
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  },
  pick: ({ name, options }) => options.find((option) => option === record[name]) ?? null,
});

type ParseParams = {
  readonly raw: unknown;
};

export const parseDecideAction = ({ raw }: ParseParams): DecideAction | null => {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const record: Record<string, unknown> = { ...raw };
  const read = readerOf({ record });
  const actionId = read.id({ name: 'actionId' });
  const workspaceId = read.id({ name: 'workspaceId' });
  const sessionId = read.id({ name: 'sessionId' });
  if (actionId === null || workspaceId === null || sessionId === null) {
    return null;
  }
  const base = { actionId, workspaceId, sessionId };
  switch (record.kind) {
    case 'answerQuestion': {
      const questionId = read.id({ name: 'questionId' });
      const seenVersion = read.id({ name: 'seenVersion' });
      const text = read.text({ name: 'text' });
      if (questionId === null || seenVersion === null || text === null) {
        return null;
      }
      return { kind: 'answerQuestion', ...base, questionId, seenVersion, text };
    }
    case 'approvePlan': {
      const planId = read.id({ name: 'planId' });
      const seenPlanVersion = read.int({ name: 'seenPlanVersion' });
      if (planId === null || seenPlanVersion === null) {
        return null;
      }
      return { kind: 'approvePlan', ...base, planId, seenPlanVersion };
    }
    case 'requestPlanChanges': {
      const planId = read.id({ name: 'planId' });
      const seenPlanVersion = read.int({ name: 'seenPlanVersion' });
      const text = read.text({ name: 'text' });
      if (planId === null || seenPlanVersion === null || text === null) {
        return null;
      }
      return { kind: 'requestPlanChanges', ...base, planId, seenPlanVersion, text };
    }
    case 'answerPermission': {
      const agentId = read.id({ name: 'agentId' });
      const requestId = read.id({ name: 'requestId' });
      const seenInputHash = read.id({ name: 'seenInputHash' });
      const verdict = read.pick({ name: 'verdict', options: ['allow', 'deny'] });
      if (agentId === null || requestId === null || seenInputHash === null || verdict === null) {
        return null;
      }
      return { kind: 'answerPermission', ...base, agentId, requestId, seenInputHash, verdict };
    }
    case 'raiseLimit': {
      const runId = read.id({ name: 'runId' });
      const seenLimit = read.number({ name: 'seenLimit' });
      const offeredAmount = read.number({ name: 'offeredAmount' });
      if (runId === null || seenLimit === null || offeredAmount === null) {
        return null;
      }
      return { kind: 'raiseLimit', ...base, runId, seenLimit, offeredAmount };
    }
    case 'undoRaiseLimit': {
      const runId = read.id({ name: 'runId' });
      const raisedActionId = read.id({ name: 'raisedActionId' });
      if (runId === null || raisedActionId === null) {
        return null;
      }
      return { kind: 'undoRaiseLimit', ...base, runId, raisedActionId };
    }
    case 'stopRun':
    case 'continueRun': {
      const runId = read.id({ name: 'runId' });
      const seenState = read.pick({ name: 'seenState', options: RUN_STATES });
      if (runId === null || seenState === null) {
        return null;
      }
      return { kind: record.kind, ...base, runId, seenState };
    }
    case 'stopAgent':
    case 'continueAgent': {
      const agentId = read.id({ name: 'agentId' });
      const seenState = read.pick({ name: 'seenState', options: AGENT_STATES });
      if (agentId === null || seenState === null) {
        return null;
      }
      return { kind: record.kind, ...base, agentId, seenState };
    }
    case 'stopAgentTree': {
      const agentId = read.id({ name: 'agentId' });
      const seenState = read.pick({ name: 'seenState', options: AGENT_STATES });
      if (agentId === null || seenState === null) {
        return null;
      }
      return { kind: 'stopAgentTree', ...base, agentId, seenState };
    }
    case 'sendToAgent': {
      const agentId = read.id({ name: 'agentId' });
      const seenVersion = read.id({ name: 'seenVersion' });
      const text = read.text({ name: 'text' });
      if (agentId === null || seenVersion === null || text === null) {
        return null;
      }
      return { kind: 'sendToAgent', ...base, agentId, seenVersion, text };
    }
    case 'answerSlackReply': {
      const verdict = read.pick({ name: 'verdict', options: ['send', 'discard'] });
      const draftId = read.id({ name: 'draftId' });
      const seenVersion = read.id({ name: 'seenVersion' });
      const text = read.text({ name: 'text' });
      if (verdict === null || draftId === null || seenVersion === null || text === null) {
        return null;
      }
      return { kind: 'answerSlackReply', ...base, verdict, draftId, seenVersion, text };
    }
    default:
      return null;
  }
};
