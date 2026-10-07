import { describe, expect, it } from 'vitest';
import type { AgentId, ResolveAttempt, SessionId } from '@goodboy/types';
import { fixRunCommitsViewOf, fixRunStatusOf } from './fixRunStatus';

const AGENT = 'agent-fix' as AgentId;

const attemptOf = ({
  phase,
  agentId = AGENT,
}: {
  readonly phase: ResolveAttempt['phase'];
  readonly agentId?: AgentId;
}): ResolveAttempt => ({
  id: `attempt-${phase}`,
  sessionId: 'session-1' as SessionId,
  agentId,
  prNumber: 318,
  threadIds: ['PRRT_one'],
  provider: 'anthropic',
  model: 'claude-sonnet-5',
  effort: null,
  instructions: null,
  phase,
  mountTarget: null,
  startedAt: 1,
  endedAt: null,
  error: null,
  createdAt: 1,
  batchId: null,
  copyPath: null,
  launchChoice: null,
});

describe('fixRunStatusOf', () => {
  it('is working while an attempt of the agent runs', () => {
    expect(
      fixRunStatusOf({
        attempts: [attemptOf({ phase: 'running' })],
        agentId: AGENT,
        turnKind: 'running',
      }),
    ).toBe('working');
  });

  it('prefers waiting over running and queued', () => {
    const attempts = [
      attemptOf({ phase: 'queued' }),
      attemptOf({ phase: 'running' }),
      attemptOf({ phase: 'waiting' }),
    ];
    expect(fixRunStatusOf({ attempts, agentId: AGENT, turnKind: null })).toBe('waiting');
  });

  it('is queued when nothing runs yet', () => {
    expect(
      fixRunStatusOf({
        attempts: [attemptOf({ phase: 'queued' })],
        agentId: AGENT,
        turnKind: null,
      }),
    ).toBe('queued');
  });

  it('is ended once the turn ended, whatever the attempt phase says', () => {
    expect(
      fixRunStatusOf({
        attempts: [attemptOf({ phase: 'running' })],
        agentId: AGENT,
        turnKind: 'ended',
      }),
    ).toBe('ended');
  });

  it('is ended when every attempt finished, failed or was cancelled', () => {
    const attempts = [attemptOf({ phase: 'finished' }), attemptOf({ phase: 'failed' })];
    expect(fixRunStatusOf({ attempts, agentId: AGENT, turnKind: null })).toBe('ended');
  });

  it('ignores the attempts of other agents', () => {
    const attempts = [attemptOf({ phase: 'running', agentId: 'other' as AgentId })];
    expect(fixRunStatusOf({ attempts, agentId: AGENT, turnKind: null })).toBe('ended');
  });
});

describe('fixRunCommitsViewOf', () => {
  it('lists commits whenever there are some', () => {
    expect(fixRunCommitsViewOf({ commitCount: 2, status: 'working', isLoaded: false })).toBe(
      'list',
    );
  });

  it('shows nothing while the run works without commits', () => {
    expect(fixRunCommitsViewOf({ commitCount: 0, status: 'working', isLoaded: true })).toBe(
      'hidden',
    );
    expect(fixRunCommitsViewOf({ commitCount: 0, status: 'waiting', isLoaded: true })).toBe(
      'hidden',
    );
  });

  it('says there are none only after the run ended and the comments loaded', () => {
    expect(fixRunCommitsViewOf({ commitCount: 0, status: 'ended', isLoaded: true })).toBe('none');
    expect(fixRunCommitsViewOf({ commitCount: 0, status: 'ended', isLoaded: false })).toBe(
      'hidden',
    );
  });
});
