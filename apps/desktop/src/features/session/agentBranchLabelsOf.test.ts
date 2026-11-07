// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { aProject, anAgent, nextSessionId } from '@goodboy/types/testing';
import { agentBranchLabelsOf } from './agentBranchLabelsOf';
import { aMountView } from './testing/aMountView';
import { aSessionRun } from './testing/aSessionRun';
import type { WorkBranch } from './workBranchesOf';

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

const branchOf = (view: typeof DUP): WorkBranch => ({
  mountId: view.id,
  projectId: view.projectId,
  projectName: view.mountName,
  branch: view.branch,
  worktreePath: view.worktreePath,
});

const ON_DUP = anAgent({ sessionId: SESSION, mountId: DUP.id });
const ON_RETRY = anAgent({ sessionId: SESSION, mountId: RETRY.id });

describe('agentBranchLabelsOf', () => {
  it('names the branch of each agent of a run that touches two', () => {
    const run = aSessionRun({
      id: 'limit',
      branches: [branchOf(DUP), branchOf(RETRY)],
    });

    const labels = agentBranchLabelsOf({
      runs: [{ ...run, agentIds: [ON_DUP.id, ON_RETRY.id] }],
      agents: [ON_DUP, ON_RETRY],
      mounts: [DUP, RETRY],
      projects: PROJECTS,
    });

    expect(labels.get(ON_DUP.id)).toBe('fix/duplicate-credit');
    expect(labels.get(ON_RETRY.id)).toBe('feat/retry-budget');
  });

  it('says nothing for a run on one branch', () => {
    const run = aSessionRun({ id: 'block', branches: [branchOf(DUP)] });

    const labels = agentBranchLabelsOf({
      runs: [{ ...run, agentIds: [ON_DUP.id] }],
      agents: [ON_DUP],
      mounts: [DUP, RETRY],
      projects: PROJECTS,
    });

    expect(labels.size).toBe(0);
  });
});
