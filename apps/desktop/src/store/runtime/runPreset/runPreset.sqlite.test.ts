import { describe, expect, it } from 'vitest';
import { AUTO_SEED_ROOT } from '@goodboy/db/test-helpers/auto-seeds';
import {
  brandId,
  type AgentId,
  type RunPreset,
  type WorkflowRoutingLock,
  type WorkspaceId,
} from '@goodboy/types';
import { runAutoCommand } from '../auto/runAutoCommand';
import { makeAutoWorld } from '../auto/testing/autoWorld';
import { makeFakePorts, WORLD_GRANT } from '../auto/testing/fakePorts';
import type { RoutingRequest } from '../auto/ports';
import { readRunStepLock } from './readRunStepLock';
import { writeRunPreset } from './writeRunPreset';

const workspaceId = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const LEAD = brandId<AgentId>({ value: AUTO_SEED_ROOT });
const OTHER = brandId<AgentId>({ value: 'agent-notify-relay' });

const LOCK: WorkflowRoutingLock = {
  version: 1,
  pick: { provider: 'anthropic', model: 'claude-opus-5-5', effort: 'high' },
  origin: 'user',
};

const PRESET: RunPreset = {
  workflowId: 'workflow-layout',
  name: 'Fix a layout',
  steps: [
    { name: 'Find', role: 'scout', promptPrefix: '', isPinned: false, routingLock: null },
    { name: 'Build', role: 'implementer', promptPrefix: '', isPinned: true, routingLock: LOCK },
  ],
};

describe('preset of a Lead', () => {
  it('reads the lock of the step whose role matches, and nothing for another role or Lead', async () => {
    const { db } = await makeAutoWorld();

    await writeRunPreset({ db, workspaceId, agentId: LEAD, preset: PRESET });

    expect(await readRunStepLock({ db, workspaceId, agentId: LEAD, role: 'implementer' })).toEqual(
      LOCK,
    );
    expect(await readRunStepLock({ db, workspaceId, agentId: LEAD, role: 'scout' })).toBeNull();
    expect(
      await readRunStepLock({ db, workspaceId, agentId: OTHER, role: 'implementer' }),
    ).toBeNull();
  });

  it('hands the pinned model to the routing of the child the Lead starts for that step', async () => {
    const world = await makeAutoWorld();
    await writeRunPreset({ db: world.db, workspaceId, agentId: LEAD, preset: PRESET });
    const ports = makeFakePorts();
    const requests: RoutingRequest[] = [];
    const resolveRouting = ports.resolveRouting;
    const capturing = {
      ...ports,
      resolveRouting: async (request: RoutingRequest) => {
        requests.push(request);
        return resolveRouting(request);
      },
    };

    const outcome = await runAutoCommand({
      ctx: { db: world.db, scheduler: world.scheduler, ports: capturing, now: world.clock.now },
      command: {
        verb: 'delegate',
        grant: WORLD_GRANT,
        args: {
          'request-id': 'request-acme',
          spec: JSON.stringify([
            { role: 'scout', task: 'read ledger-core', reason: 'find callers' },
            {
              role: 'implementer',
              task: 'fix the totals table',
              reason: 'the plan step',
              mount: 'mount-ledger-core',
            },
          ]),
        },
      },
    });

    expect(outcome.isOk).toBe(true);
    expect(requests.map((request) => [request.role, request.stepLock ?? null])).toEqual([
      ['scout', null],
      ['implementer', LOCK],
    ]);
  });
});
