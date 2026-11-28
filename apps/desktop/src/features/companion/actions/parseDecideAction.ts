import type { AgentState, RunState } from '../contract/projections';
import { readerOf } from './actionReader';
import type { DecideAction } from './decideAction';

const RUN_STATES: ReadonlyArray<RunState> = [
  'running',
  'paused',
  'waiting',
  'stopped',
  'done',
  'failed',
];

const AGENT_STATES: ReadonlyArray<AgentState> = ['running', 'waiting', 'stopped', 'done', 'failed'];

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
    case 'decideProposal': {
      const delegationId = read.id({ name: 'delegationId' });
      const seenVersion = read.id({ name: 'seenVersion' });
      const choice = read.pick({
        name: 'choice',
        options: ['primary', 'alternative-0', 'alternative-1', 'notNow'],
      });
      if (delegationId === null || seenVersion === null || choice === null) {
        return null;
      }
      return { kind: 'decideProposal', ...base, delegationId, seenVersion, choice };
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
      const verdict = read.pick({ name: 'verdict', options: ['allow', 'allowAlways', 'deny'] });
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
