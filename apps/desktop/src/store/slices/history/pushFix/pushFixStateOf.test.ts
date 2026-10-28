// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  brandId,
  type Agent,
  type AgentId,
  type IsoDateTime,
  type MountId,
  type ProjectId,
  type SessionId,
} from '@goodboy/types';
import { pushFixStateOf } from './pushFixStateOf';
import type { BranchPushFix, PushFixOutcome } from '../types';

const SESSION_ID = brandId<SessionId>({ value: 'session-push-state' });
const MOUNT_ID = brandId<MountId>({ value: 'mount-push-state' });
const OTHER_MOUNT_ID = brandId<MountId>({ value: 'mount-other' });
const AGENT_ID = brandId<AgentId>({ value: 'agent-fixer' });

const fix = (overrides: Partial<BranchPushFix> = {}): BranchPushFix => ({
  agentId: AGENT_ID,
  sessionId: SESSION_ID,
  mountId: MOUNT_ID,
  identity: {
    worktreePath: '/w/ledger-core',
    branch: 'fix/ledger',
    projectId: brandId<ProjectId>({ value: 'p' }),
  },
  isForce: false,
  confirmedOnlyOnline: null,
  confirmedRemoteSha: null,
  startedAt: 1,
  ...overrides,
});

const agent = (overrides: Partial<Agent> = {}): Agent => ({
  id: AGENT_ID,
  sessionId: SESSION_ID,
  ordinal: 1,
  name: 'Fix the push',
  status: 'running',
  mountId: MOUNT_ID,
  ...overrides,
});

const outcome = (overrides: Partial<PushFixOutcome> = {}): PushFixOutcome => ({
  agentId: AGENT_ID,
  sessionId: SESSION_ID,
  mountId: MOUNT_ID,
  kind: 'pushed',
  reason: null,
  settledAt: 2,
  isClaimed: false,
  followUp: null,
  ...overrides,
});

type StateParams = {
  readonly fixes?: Record<AgentId, BranchPushFix>;
  readonly outcomes?: Record<MountId, PushFixOutcome>;
  readonly agents?: ReadonlyArray<Agent> | undefined;
};

const stateOf = ({ fixes = {}, outcomes = {}, agents }: StateParams) =>
  pushFixStateOf({ fixes, outcomes, agents, sessionId: SESSION_ID, mountId: MOUNT_ID });

describe('pushFixStateOf', () => {
  it('is none when nothing started a fix on this branch', () => {
    expect(stateOf({})).toEqual({ kind: 'none' });
    expect(stateOf({ agents: [agent({ name: 'Review the diff' })] })).toEqual({ kind: 'none' });
  });

  it('is working while the window tracks the fix, even before the agent list loads', () => {
    expect(stateOf({ fixes: { [AGENT_ID]: fix() } })).toEqual({
      kind: 'working',
      agentId: AGENT_ID,
    });
  });

  it('finds a running fix agent of that branch in the saved agents when the window forgot it', () => {
    expect(stateOf({ agents: [agent()] })).toEqual({ kind: 'working', agentId: AGENT_ID });
    expect(stateOf({ agents: [agent({ status: 'pending' })] }).kind).toBe('working');
  });

  it('ignores a fix agent of another branch, a deleted one and a finished one', () => {
    expect(stateOf({ agents: [agent({ mountId: OTHER_MOUNT_ID })] }).kind).toBe('none');
    expect(
      stateOf({
        agents: [agent({ deletedAt: brandId<IsoDateTime>({ value: '2026-10-28T10:00:00.000Z' }) })],
      }).kind,
    ).toBe('none');
    expect(stateOf({ agents: [agent({ status: 'completed' })] }).kind).toBe('none');
  });

  it('drops a remembered fix whose agent is gone or finished', () => {
    const fixes = { [AGENT_ID]: fix() };
    expect(stateOf({ fixes, agents: [] }).kind).toBe('none');
    expect(stateOf({ fixes, agents: [agent({ status: 'failed' })] }).kind).toBe('none');
    expect(stateOf({ fixes, agents: [agent({ status: 'running' })] }).kind).toBe('working');
  });

  it('reads a pushed outcome with the follow up the waiting action reported', () => {
    const followUp = { tone: 'done', sentence: 'Pull request #318 is open.' } as const;

    expect(stateOf({ outcomes: { [MOUNT_ID]: outcome({ isClaimed: true, followUp }) } })).toEqual({
      kind: 'pushed',
      agentId: AGENT_ID,
      isClaimed: true,
      followUp,
    });
  });

  it('reads which step failed and why', () => {
    expect(
      stateOf({
        outcomes: { [MOUNT_ID]: outcome({ kind: 'agent_failed', reason: 'The agent stopped.' }) },
      }),
    ).toEqual({ kind: 'failed', agentId: AGENT_ID, step: 'agent', reason: 'The agent stopped.' });
    expect(
      stateOf({
        outcomes: {
          [MOUNT_ID]: outcome({ kind: 'push_failed', reason: 'pre-push: knip failed' }),
        },
      }),
    ).toEqual({
      kind: 'failed',
      agentId: AGENT_ID,
      step: 'push',
      reason: 'pre-push: knip failed',
    });
  });

  it('prefers a running agent over an older outcome, and never reads another session outcome', () => {
    expect(
      stateOf({
        outcomes: { [MOUNT_ID]: outcome() },
        agents: [agent({ id: brandId<AgentId>({ value: 'agent-new' }) })],
      }),
    ).toEqual({ kind: 'working', agentId: 'agent-new' });
    expect(
      stateOf({
        outcomes: {
          [MOUNT_ID]: outcome({ sessionId: brandId<SessionId>({ value: 'session-other' }) }),
        },
      }),
    ).toEqual({ kind: 'none' });
  });
});
