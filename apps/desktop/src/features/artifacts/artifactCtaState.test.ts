import { describe, expect, it } from 'vitest';
import type {
  Agent,
  AgentId,
  AgentStatus,
  IsoDateTime,
  SessionId,
  WorkflowRunId,
} from '@goodboy/types';
import { resolveArtifactCtaState } from './artifactCtaState';

const SESSION_ID = 'session-1' as SessionId;
const RUN_ID = 'run-1' as WorkflowRunId;

type AgentParams = {
  readonly id: string;
  readonly status: AgentStatus;
  readonly workflowRunId?: WorkflowRunId;
  readonly outputSummary?: string;
  readonly lastFinishedAt?: IsoDateTime;
};

const agent = ({
  id,
  status,
  workflowRunId,
  outputSummary,
  lastFinishedAt,
}: AgentParams): Agent => ({
  id: id as AgentId,
  sessionId: SESSION_ID,
  ordinal: 0,
  name: id,
  status,
  ...(workflowRunId !== undefined && { workflowRunId }),
  ...(outputSummary !== undefined && { outputSummary }),
  ...(lastFinishedAt !== undefined && { lastFinishedAt }),
});

describe('resolveArtifactCtaState', () => {
  it('is blocked with nothing to report on', () => {
    expect(
      resolveArtifactCtaState({
        agents: [],
        runAgents: null,
        hasSourceActiveTurn: false,
        hasSessionActiveTurn: false,
        isSummarizerRunning: false,
      }),
    ).toEqual({ kind: 'blocked', reason: 'no-evidence' });
  });

  it('is ready once every agent has stopped and the session is idle', () => {
    expect(
      resolveArtifactCtaState({
        agents: [agent({ id: 'a', status: 'completed' })],
        runAgents: null,
        hasSourceActiveTurn: false,
        hasSessionActiveTurn: false,
        isSummarizerRunning: false,
      }),
    ).toEqual({ kind: 'ready' });
  });

  it('resolves to ready for a session whose only leftover is a stale pending agent', () => {
    const agents = [
      ...Array.from({ length: 25 }, (_, index) =>
        agent({ id: `completed-${index}`, status: 'completed' }),
      ),
      agent({
        id: 'stale',
        status: 'pending',
        lastFinishedAt: '2026-09-15T12:00:00Z' as IsoDateTime,
      }),
    ];

    expect(
      resolveArtifactCtaState({
        agents,
        runAgents: null,
        hasSourceActiveTurn: false,
        hasSessionActiveTurn: false,
        isSummarizerRunning: false,
      }),
    ).toEqual({ kind: 'ready' });
  });

  it.each(['pending', 'skipped'] satisfies ReadonlyArray<AgentStatus>)(
    'does not count an unproductive %s agent as evidence',
    (status) => {
      expect(
        resolveArtifactCtaState({
          agents: [agent({ id: 'a', status, outputSummary: '   ' })],
          runAgents: null,
          hasSourceActiveTurn: false,
          hasSessionActiveTurn: false,
          isSummarizerRunning: false,
        }),
      ).toEqual({ kind: 'blocked', reason: 'no-evidence' });
    },
  );

  it('accepts failed work as evidence', () => {
    expect(
      resolveArtifactCtaState({
        agents: [agent({ id: 'a', status: 'failed' })],
        runAgents: null,
        hasSourceActiveTurn: false,
        hasSessionActiveTurn: false,
        isSummarizerRunning: false,
      }),
    ).toEqual({ kind: 'ready' });
  });

  it('accepts a pending agent with an output summary as evidence', () => {
    expect(
      resolveArtifactCtaState({
        agents: [agent({ id: 'a', status: 'pending', outputSummary: 'reviewed ledger-core' })],
        runAgents: null,
        hasSourceActiveTurn: false,
        hasSessionActiveTurn: false,
        isSummarizerRunning: false,
      }),
    ).toEqual({ kind: 'ready' });
  });

  it('requires evidence from the selected run', () => {
    const pending = agent({ id: 'pending', status: 'pending', workflowRunId: RUN_ID });
    expect(
      resolveArtifactCtaState({
        agents: [agent({ id: 'completed', status: 'completed' }), pending],
        runAgents: [pending],
        hasSourceActiveTurn: false,
        hasSessionActiveTurn: false,
        isSummarizerRunning: false,
      }),
    ).toEqual({ kind: 'blocked', reason: 'no-evidence' });
  });

  it('blocks a pending agent with a live turn even before it produces evidence', () => {
    expect(
      resolveArtifactCtaState({
        agents: [agent({ id: 'pending', status: 'pending' })],
        runAgents: null,
        hasSourceActiveTurn: true,
        hasSessionActiveTurn: true,
        isSummarizerRunning: false,
      }),
    ).toEqual({ kind: 'blocked', reason: 'run-active' });
  });

  it('is blocked while the source run is still going', () => {
    expect(
      resolveArtifactCtaState({
        agents: [agent({ id: 'a', status: 'running', workflowRunId: RUN_ID })],
        runAgents: [agent({ id: 'a', status: 'running', workflowRunId: RUN_ID })],
        hasSourceActiveTurn: false,
        hasSessionActiveTurn: false,
        isSummarizerRunning: false,
      }),
    ).toEqual({ kind: 'blocked', reason: 'run-active' });
  });

  it('is blocked when the run finished but the session is still busy elsewhere', () => {
    expect(
      resolveArtifactCtaState({
        agents: [
          agent({ id: 'a', status: 'completed', workflowRunId: RUN_ID }),
          agent({ id: 'b', status: 'running' }),
        ],
        runAgents: [agent({ id: 'a', status: 'completed', workflowRunId: RUN_ID })],
        hasSourceActiveTurn: false,
        hasSessionActiveTurn: false,
        isSummarizerRunning: false,
      }),
    ).toEqual({ kind: 'blocked', reason: 'session-busy' });
  });

  it('is blocked while a turn or the summarizer runs', () => {
    const agents = [agent({ id: 'a', status: 'completed' })];
    expect(
      resolveArtifactCtaState({
        agents,
        runAgents: null,
        hasSourceActiveTurn: false,
        hasSessionActiveTurn: true,
        isSummarizerRunning: false,
      }),
    ).toEqual({ kind: 'blocked', reason: 'session-busy' });
    expect(
      resolveArtifactCtaState({
        agents,
        runAgents: null,
        hasSourceActiveTurn: false,
        hasSessionActiveTurn: false,
        isSummarizerRunning: true,
      }),
    ).toEqual({ kind: 'blocked', reason: 'session-busy' });
  });
});
