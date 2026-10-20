// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type AgentId } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import {
  aDelegation,
  aView,
  FIXTURE_NOW,
  FIXTURE_ROOT,
} from '../../../auto/testing/autoViewFixtures';
import { liveGroupsOf } from './liveGroupsOf';
import {
  aNowAgent,
  aNowRun,
  aNowStepAgent,
  aNowWorkflow,
  NOW_MOUNT_API,
  NOW_MOUNT_LEDGER,
  NOW_SESSION,
  NOW_STARTED_AT,
  nowModelOf,
} from './testing/nowModelOf';

const BUILD_STEPS = ['Scope', 'Tests', 'Implement', 'Review', 'Docs', 'Ship'];

const buildRun = () =>
  aNowRun({
    key: 'build',
    title: 'Build',
    workflow: aNowWorkflow({ key: 'build', name: 'Build', stepNames: BUILD_STEPS }),
  });

describe('liveGroupsOf', () => {
  it('makes one group per launch with the step counts and the single mount', () => {
    const attached = buildRun();
    const agents = [
      aNowStepAgent({
        attached,
        stepIndex: 0,
        status: 'completed',
        name: 'Scope',
        mountId: NOW_MOUNT_API,
      }),
      aNowStepAgent({
        attached,
        stepIndex: 1,
        status: 'completed',
        name: 'Tests',
        mountId: NOW_MOUNT_API,
      }),
      aNowStepAgent({
        attached,
        stepIndex: 2,
        status: 'running',
        name: 'Implement',
        mountId: NOW_MOUNT_API,
      }),
    ];
    const groups = liveGroupsOf({
      model: nowModelOf({ agents, runs: [attached] }),
      agents,
      now: FIXTURE_NOW,
    });

    expect(groups).toHaveLength(1);
    const [group] = groups;
    expect(group?.kind).toBe('run');
    expect(group?.title).toBe('Build');
    expect(group?.state).toBe('working');
    expect(group?.mountId).toBe(NOW_MOUNT_API);
    expect(group?.counts).toEqual({ started: 3, total: 6 });
  });

  it('gives a run that spans two mounts no mount', () => {
    const attached = buildRun();
    const agents = [
      aNowStepAgent({
        attached,
        stepIndex: 0,
        status: 'completed',
        name: 'Scope',
        mountId: NOW_MOUNT_API,
      }),
      aNowStepAgent({
        attached,
        stepIndex: 1,
        status: 'running',
        name: 'Tests',
        mountId: NOW_MOUNT_LEDGER,
      }),
    ];
    const [group] = liveGroupsOf({
      model: nowModelOf({ agents, runs: [attached] }),
      agents,
      now: FIXTURE_NOW,
    });

    expect(group?.mountId).toBeNull();
  });

  it('marks an orchestrated run deciding while it chooses the next step', () => {
    const attached = aNowRun({
      key: 'orch',
      title: 'Map the payout code',
      isDynamic: true,
      workflow: aNowWorkflow({
        key: 'orch',
        name: 'Orchestrated',
        stepNames: ['Map the payout code'],
        origin: 'orchestrated',
      }),
    });
    const agents = [
      aNowStepAgent({ attached, stepIndex: 0, status: 'completed', name: 'Map the payout code' }),
    ];
    const [group] = liveGroupsOf({
      model: nowModelOf({
        agents,
        runs: [attached],
        decidingRunIds: new Set([attached.run.id]),
      }),
      agents,
      now: FIXTURE_NOW,
    });

    expect(group?.kind).toBe('orchestrated');
    expect(group?.state).toBe('deciding');
    expect(group?.counts).toEqual({ started: 1, total: null });
  });

  it('nests Auto children and never repeats them as agent groups', () => {
    const root = anAgent({
      id: FIXTURE_ROOT,
      sessionId: NOW_SESSION,
      kind: 'auto',
      name: 'Check the payout docs',
      status: 'running',
      startedAt: NOW_STARTED_AT,
    });
    const fixer = anAgent({
      id: brandId<AgentId>({ value: 'agent-fixer' }),
      sessionId: NOW_SESSION,
      parentAgentId: FIXTURE_ROOT,
      name: 'Fixer',
      status: 'running',
    });
    const view = aView({
      phase: 'waiting',
      delegations: [aDelegation({ key: 'fixer', role: 'implementer', state: 'running' })],
    });
    const agents = [root, fixer];
    const groups = liveGroupsOf({
      model: nowModelOf({ agents, autoTrees: [view] }),
      agents,
      now: FIXTURE_NOW,
    });

    expect(groups.map((group) => group.kind)).toEqual(['auto']);
    expect(groups[0]?.children).toHaveLength(1);
  });

  it('leaves finished launches out', () => {
    const attached = aNowRun({
      key: 'done',
      title: 'Build',
      workflow: aNowWorkflow({ key: 'done', name: 'Build', stepNames: ['Scope', 'Tests'] }),
    });
    const agents = [
      aNowStepAgent({ attached, stepIndex: 0, status: 'completed', name: 'Scope' }),
      aNowStepAgent({ attached, stepIndex: 1, status: 'completed', name: 'Tests' }),
      aNowAgent({ key: 'old', name: 'Add the limit table', status: 'completed' }),
    ];

    expect(
      liveGroupsOf({ model: nowModelOf({ agents, runs: [attached] }), agents, now: FIXTURE_NOW }),
    ).toEqual([]);
  });

  it('orders stuck, then waiting on you, then working', () => {
    const agents = [
      aNowAgent({ key: 'working', name: 'Add the limit table', status: 'running' }),
      aNowAgent({ key: 'blocked', name: 'Check the docs', status: 'blocked' }),
      aNowAgent({ key: 'failed', name: 'Rebuild the index', status: 'failed' }),
    ];
    const groups = liveGroupsOf({ model: nowModelOf({ agents }), agents, now: FIXTURE_NOW });

    expect(groups.map((group) => group.state)).toEqual(['stuck', 'waiting', 'working']);
  });
});
