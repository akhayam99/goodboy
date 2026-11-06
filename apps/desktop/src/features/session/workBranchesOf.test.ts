// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type MountId } from '@goodboy/types';
import { aProject, anAgent, nextSessionId, nextWorkflowRunId } from '@goodboy/types/testing';
import { aMountView } from './testing/aMountView';
import { workBranchesOf } from './workBranchesOf';

const SESSION = nextSessionId();
const PAYMENTS = aProject({ name: 'payments-api' });
const NOTIFY = aProject({ name: 'notify-relay' });
const DUP = aMountView({
  key: 'dup',
  sessionId: SESSION,
  projectId: PAYMENTS.id,
  projectName: 'payments-api',
  branch: 'fix/duplicate-credit',
});
const RETRY = aMountView({
  key: 'retry',
  sessionId: SESSION,
  projectId: NOTIFY.id,
  projectName: 'notify-relay',
  branch: 'feat/retry-budget',
});
const PROJECTS = [PAYMENTS, NOTIFY];
const RUN = nextWorkflowRunId();

describe('workBranchesOf', () => {
  it('reads the branch of an agent through its mount', () => {
    const agent = anAgent({ sessionId: SESSION, mountId: DUP.id });
    const branches = workBranchesOf({
      agentIds: [agent.id],
      agents: [agent],
      mounts: [DUP, RETRY],
      projects: PROJECTS,
    });
    expect(branches).toEqual([
      {
        mountId: DUP.id,
        projectId: PAYMENTS.id,
        projectName: 'payments-api',
        branch: 'fix/duplicate-credit',
      },
    ]);
  });

  it('lets a step without a mount inherit the mount of the step before it', () => {
    const first = anAgent({ sessionId: SESSION, workflowRunId: RUN, ordinal: 0, mountId: DUP.id });
    const second = anAgent({ sessionId: SESSION, workflowRunId: RUN, ordinal: 1 });
    const branches = workBranchesOf({
      agentIds: [second.id],
      agents: [first, second],
      mounts: [DUP],
      projects: PROJECTS,
    });
    expect(branches.map((branch) => branch.branch)).toEqual(['fix/duplicate-credit']);
  });

  it('counts a read only agent as work on its branch', () => {
    const reviewer = anAgent({ sessionId: SESSION, mountId: RETRY.id, kind: 'reviewer' });
    const branches = workBranchesOf({
      agentIds: [reviewer.id],
      agents: [reviewer],
      mounts: [RETRY],
      projects: PROJECTS,
    });
    expect(branches.map((branch) => branch.branch)).toEqual(['feat/retry-budget']);
  });

  it('lists one branch once however many agents touch it and keeps the order of agents', () => {
    const first = anAgent({ sessionId: SESSION, mountId: RETRY.id });
    const second = anAgent({ sessionId: SESSION, mountId: DUP.id });
    const third = anAgent({ sessionId: SESSION, mountId: RETRY.id });
    const branches = workBranchesOf({
      agentIds: [first.id, second.id, third.id],
      agents: [first, second, third],
      mounts: [DUP, RETRY],
      projects: PROJECTS,
    });
    expect(branches.map((branch) => branch.branch)).toEqual([
      'feat/retry-budget',
      'fix/duplicate-credit',
    ]);
  });

  it('ignores agents outside the run', () => {
    const mine = anAgent({ sessionId: SESSION, mountId: DUP.id });
    const other = anAgent({ sessionId: SESSION, mountId: RETRY.id });
    const branches = workBranchesOf({
      agentIds: [mine.id],
      agents: [mine, other],
      mounts: [DUP, RETRY],
      projects: PROJECTS,
    });
    expect(branches).toHaveLength(1);
  });

  it('leaves a run without a branch when its mount was detached or never existed', () => {
    const detached = aMountView({
      key: 'gone',
      sessionId: SESSION,
      projectId: PAYMENTS.id,
      projectName: 'payments-api',
      branch: 'fix/gone',
      isAttached: false,
    });
    const onDetached = anAgent({ sessionId: SESSION, mountId: detached.id });
    const onUnknown = anAgent({
      sessionId: SESSION,
      mountId: brandId<MountId>({ value: 'mount-unknown' }),
    });
    const branches = workBranchesOf({
      agentIds: [onDetached.id, onUnknown.id],
      agents: [onDetached, onUnknown],
      mounts: [detached],
      projects: PROJECTS,
    });
    expect(branches).toEqual([]);
  });

  it('falls back to the mount name when the project is unknown', () => {
    const agent = anAgent({ sessionId: SESSION, mountId: DUP.id });
    const branches = workBranchesOf({
      agentIds: [agent.id],
      agents: [agent],
      mounts: [DUP],
      projects: [],
    });
    expect(branches[0]?.projectName).toBe('payments-api');
  });
});
