// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type AgentId } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import {
  aDelegation,
  aView,
  FIXTURE_ROOT,
  FIXTURE_SESSION,
} from '../../../auto/testing/autoViewFixtures';
import { doneRowsOf } from './doneRowsOf';
import { at, eventOf, modelOf, NOW, stepAgent, workflowOf } from './testing/doneFixtures';

const done = (overrides: Parameters<typeof anAgent>[0] = {}) =>
  anAgent({
    sessionId: FIXTURE_SESSION,
    status: 'completed',
    startedAt: at({ hour: 9 }),
    completedAt: at({ hour: 9, minute: 20 }),
    ...overrides,
  });

const rowsOf = (model: Parameters<typeof doneRowsOf>[0]['model']) =>
  doneRowsOf({ model }).flatMap((day) => day.rows);

describe('doneRowsOf', () => {
  it('lists finished work only', () => {
    const model = modelOf({
      agents: [
        done({ id: brandId<AgentId>({ value: 'finished' }), kind: 'scribe', name: 'a' }),
        done({ id: brandId<AgentId>({ value: 'live' }), status: 'running', name: 'b' }),
        done({ id: brandId<AgentId>({ value: 'broken' }), status: 'failed', name: 'c' }),
        done({ id: brandId<AgentId>({ value: 'queued' }), status: 'pending', name: 'd' }),
      ],
    });

    expect(rowsOf(model).map((row) => row.entryId)).toEqual(['agent:finished']);
  });

  it('orders newest first and groups by day with a null label for today', () => {
    const model = modelOf({
      agents: [
        done({
          id: brandId<AgentId>({ value: 'old' }),
          kind: 'planner',
          completedAt: at({ day: 16, hour: 16, minute: 20 }),
        }),
        done({
          id: brandId<AgentId>({ value: 'first' }),
          kind: 'scribe',
          completedAt: at({ hour: 9, minute: 40 }),
        }),
        done({
          id: brandId<AgentId>({ value: 'second' }),
          kind: 'tester',
          completedAt: at({ hour: 10, minute: 19 }),
        }),
      ],
    });

    const days = doneRowsOf({ model });

    expect(days.map((day) => day.rows.map((row) => row.entryId))).toEqual([
      ['agent:second', 'agent:first'],
      ['agent:old'],
    ]);
    expect(days[0]?.label).toBeNull();
    expect(days[1]?.label).not.toBeNull();
  });

  it('gives a live run one row for its finished steps', () => {
    const model = modelOf({
      agents: [
        stepAgent({ index: 1, summary: 'Scoped the change.' }),
        stepAgent({ index: 2, summary: 'Wrote the tests first.' }),
        stepAgent({ index: 3, status: 'running' }),
      ],
      runs: [workflowOf({ total: 6 })],
    });

    const rows = rowsOf(model);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      entryId: 'run:run-build',
      title: 'Wrote the tests first',
      by: 'Build · steps 1 and 2 of 6',
    });
    expect([...(rows[0]?.agentIds ?? [])].sort()).toEqual(['agent-step-1', 'agent-step-2']);
  });

  it('gives a live run one row per day', () => {
    const model = modelOf({
      agents: [
        stepAgent({ index: 1, summary: 'Scoped the change.', day: 16 }),
        stepAgent({ index: 2, summary: 'Wrote the tests first.' }),
        stepAgent({ index: 3, status: 'running' }),
      ],
      runs: [workflowOf({ total: 6 })],
    });

    const days = doneRowsOf({ model });

    expect(days.map((day) => day.rows.map((row) => row.by))).toEqual([
      ['Build · step 2 of 6'],
      ['Build · step 1 of 6'],
    ]);
  });

  it('gives a finished run one row with the steps summary', () => {
    const model = modelOf({
      agents: [stepAgent({ index: 1, summary: 'A.' }), stepAgent({ index: 2, summary: 'B.' })],
      runs: [workflowOf({ total: 2 })],
    });

    const rows = rowsOf(model);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.by).toBe('Build · 2 agents · 2 of 2 steps');
    expect(rows[0]?.title).toBe('B');
  });

  it('gives a finished Auto tree one row and never its children', () => {
    const view = aView({
      phase: 'done',
      delegations: [
        aDelegation({ key: 'reviewer', role: 'reviewer', state: 'settled', outcome: 'completed' }),
        {
          ...aDelegation({
            key: 'fixer',
            role: 'implementer',
            state: 'settled',
            outcome: 'completed',
          }),
          slot: 1,
        },
      ],
    });
    const root = done({ id: FIXTURE_ROOT, kind: 'auto', name: 'Keep the retries green' });
    const children = ['reviewer', 'fixer'].map((key) =>
      done({ id: brandId<AgentId>({ value: `agent-${key}` }), kind: 'implementer', name: key }),
    );
    const model = {
      ...modelOf({ agents: [root], autoTrees: [view] }),
      agents: [root, ...children],
    };

    const rows = rowsOf(model);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.entryId).toBe(`agent:${FIXTURE_ROOT}`);
  });

  it('keeps a running Auto tree out of the list', () => {
    const view = aView({ phase: 'waiting' });
    const root = done({ id: FIXTURE_ROOT, kind: 'auto', name: 'Keep the retries green' });

    expect(rowsOf(modelOf({ agents: [root], autoTrees: [view] }))).toEqual([]);
  });

  it('lists a child you stopped or declined in a live Auto tree', () => {
    const settledAt = NOW.getTime() - 60_000;
    const view = aView({
      phase: 'waiting',
      delegations: [
        {
          ...aDelegation({
            key: 'billing',
            role: 'reviewer',
            state: 'settled',
            outcome: 'stopped',
          }),
          reason: 'stopped',
          settledAt,
          target: { mountId: 'mount-billing' },
        },
        {
          ...aDelegation({
            key: 'settings',
            role: 'implementer',
            state: 'settled',
            outcome: 'stopped',
          }),
          slot: 1,
          reason: 'declined',
          settledAt,
        },
        {
          ...aDelegation({ key: 'tester', role: 'tester', state: 'settled', outcome: 'failed' }),
          slot: 2,
          settledAt,
        },
      ],
    });
    const root = done({ id: FIXTURE_ROOT, kind: 'auto', name: 'Keep the retries green' });

    const rows = rowsOf(modelOf({ agents: [root], autoTrees: [view] }));

    expect(rows.map((row) => [row.title, row.by])).toEqual([
      ['You stopped the reviewer', 'Auto'],
      ['You declined the implementer', 'Auto'],
    ]);
    expect(rows[0]?.entryId).toBe(`agent:${FIXTURE_ROOT}`);
  });

  it('turns a rebase event into a row unless its agent already has one', () => {
    const lone = modelOf({
      events: [eventOf({ id: 'r1', kind: 'history_rewritten', payload: { origin: 'rebase' } })],
    });
    const owned = modelOf({
      agents: [done({ id: brandId<AgentId>({ value: 'rebaser' }), kind: 'rewriter' })],
      events: [
        eventOf({
          id: 'r2',
          kind: 'history_rewritten',
          payload: { origin: 'rebase', agentId: 'rebaser' },
        }),
      ],
    });

    expect(rowsOf(lone).map((row) => row.by)).toEqual(['Rebase']);
    expect(rowsOf(owned).map((row) => row.entryId)).toEqual(['agent:rebaser']);
  });
});
