// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type AgentId, type IsoDateTime } from '@goodboy/types';
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

  it('orders by state first, stuck then waiting then working, and by start time inside a state', () => {
    type MinuteParams = { readonly minute: number };
    const startedAt = ({ minute }: MinuteParams) =>
      brandId<IsoDateTime>({ value: `2026-05-01T10:0${minute}:00.000Z` });
    type StatusParams = { readonly status: 'running' | 'blocked' | 'failed' };
    const groupsWith = ({ status }: StatusParams) => {
      const agents = [
        {
          ...aNowAgent({ key: 'third', name: 'Rebuild the index', status: 'running' }),
          startedAt: startedAt({ minute: 3 }),
        },
        {
          ...aNowAgent({ key: 'first', name: 'Add the limit table', status: 'running' }),
          startedAt: startedAt({ minute: 1 }),
        },
        {
          ...aNowAgent({ key: 'second', name: 'Check the docs', status }),
          startedAt: startedAt({ minute: 2 }),
        },
      ];
      return liveGroupsOf({ model: nowModelOf({ agents }), agents, now: FIXTURE_NOW }).map(
        (group) => [group.title, group.state],
      );
    };

    expect(groupsWith({ status: 'running' })).toEqual([
      ['Add the limit table', 'working'],
      ['Check the docs', 'working'],
      ['Rebuild the index', 'working'],
    ]);
    expect(groupsWith({ status: 'blocked' })).toEqual([
      ['Check the docs', 'waiting'],
      ['Add the limit table', 'working'],
      ['Rebuild the index', 'working'],
    ]);
    expect(groupsWith({ status: 'failed' })).toEqual([
      ['Check the docs', 'stuck'],
      ['Add the limit table', 'working'],
      ['Rebuild the index', 'working'],
    ]);
  });

  it('names the role and the state of every step, from its agent or its name', () => {
    const attached = buildRun();
    const agents = [
      aNowStepAgent({ attached, stepIndex: 0, status: 'completed', name: 'Scope', kind: 'scout' }),
      aNowStepAgent({
        attached,
        stepIndex: 1,
        status: 'running',
        name: 'Tests',
        kind: 'tester',
      }),
    ];
    const [group] = liveGroupsOf({
      model: nowModelOf({ agents, runs: [attached] }),
      agents,
      now: FIXTURE_NOW,
    });
    if (group?.kind !== 'run') {
      throw new Error('the Build run must be a run group');
    }

    expect(group.steps.slice(0, 2)).toEqual([
      { number: 1, title: 'Scope', kind: 'scout', state: 'done' },
      { number: 2, title: 'Tests', kind: 'tester', state: 'running' },
    ]);
    expect(group.steps).toHaveLength(BUILD_STEPS.length);
    expect(group.steps[2]?.state).toBe('notStarted');
  });
});
