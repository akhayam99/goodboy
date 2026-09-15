import { describe, expect, it } from 'vitest';
import type { Agent, AgentId, AgentStatus, SessionId, WorkflowRunId } from '@goodboy/types';
import { resolveReportCtaState } from './reportCtaState';

const SESSION_ID = 'session-1' as SessionId;
const RUN_ID = 'run-1' as WorkflowRunId;

const agent = ({
  id,
  status,
  workflowRunId,
}: {
  readonly id: string;
  readonly status: AgentStatus;
  readonly workflowRunId?: WorkflowRunId;
}): Agent => ({
  id: id as AgentId,
  sessionId: SESSION_ID,
  ordinal: 0,
  name: id,
  status,
  ...(workflowRunId !== undefined && { workflowRunId }),
});

describe('resolveReportCtaState', () => {
  it('is blocked with nothing to report on', () => {
    expect(
      resolveReportCtaState({
        agents: [],
        runAgents: null,
        isTurnRunning: false,
        isSummarizerRunning: false,
      }),
    ).toEqual({ kind: 'blocked', reason: 'no-evidence' });
  });

  it('is ready once every agent has stopped and the session is idle', () => {
    expect(
      resolveReportCtaState({
        agents: [agent({ id: 'a', status: 'completed' })],
        runAgents: null,
        isTurnRunning: false,
        isSummarizerRunning: false,
      }),
    ).toEqual({ kind: 'ready' });
  });

  it('is blocked while the source run is still going', () => {
    expect(
      resolveReportCtaState({
        agents: [agent({ id: 'a', status: 'running', workflowRunId: RUN_ID })],
        runAgents: [agent({ id: 'a', status: 'running', workflowRunId: RUN_ID })],
        isTurnRunning: false,
        isSummarizerRunning: false,
      }),
    ).toEqual({ kind: 'blocked', reason: 'run-active' });
  });

  it('is blocked when the run finished but the session is still busy elsewhere', () => {
    expect(
      resolveReportCtaState({
        agents: [
          agent({ id: 'a', status: 'completed', workflowRunId: RUN_ID }),
          agent({ id: 'b', status: 'running' }),
        ],
        runAgents: [agent({ id: 'a', status: 'completed', workflowRunId: RUN_ID })],
        isTurnRunning: false,
        isSummarizerRunning: false,
      }),
    ).toEqual({ kind: 'blocked', reason: 'session-busy' });
  });

  it('is blocked while a turn or the summarizer runs', () => {
    const agents = [agent({ id: 'a', status: 'completed' })];
    expect(
      resolveReportCtaState({
        agents,
        runAgents: null,
        isTurnRunning: true,
        isSummarizerRunning: false,
      }),
    ).toEqual({ kind: 'blocked', reason: 'session-busy' });
    expect(
      resolveReportCtaState({
        agents,
        runAgents: null,
        isTurnRunning: false,
        isSummarizerRunning: true,
      }),
    ).toEqual({ kind: 'blocked', reason: 'session-busy' });
  });
});
