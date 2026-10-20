// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type AgentId, type MeasuredTurnSpan } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import {
  aDelegation,
  aView,
  FIXTURE_ROOT,
  FIXTURE_SESSION,
} from '../../../auto/testing/autoViewFixtures';
import { agentWorkTime, estimateKeyOf } from '../../../workTreeModel/agentWorkTime';
import type { WorkTimeSource } from '../../../workTreeModel/workTimeSource';
import { KIND_TO_ROLE } from '../../agent-kind';
import { doneRowsOf } from './doneRowsOf';
import type { DoneCosts } from './doneTypes';
import { at, eventOf, modelOf, NOW, stepAgent, workflowOf } from './testing/doneFixtures';

const NO_COSTS: DoneCosts = { byAgentId: new Map(), byRunId: new Map() };

const done = (overrides: Parameters<typeof anAgent>[0] = {}) =>
  anAgent({
    sessionId: FIXTURE_SESSION,
    status: 'completed',
    startedAt: at({ hour: 9 }),
    completedAt: at({ hour: 9, minute: 20 }),
    ...overrides,
  });

const rowsOf = (model: Parameters<typeof doneRowsOf>[0]['model']) =>
  doneRowsOf({ model, source: null, costs: NO_COSTS }).flatMap((day) => day.rows);

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

    const days = doneRowsOf({ model, source: null, costs: NO_COSTS });

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
    expect(rows[0]?.detail.steps.map((step) => step.title)).toEqual([
      'Scoped the change',
      'Wrote the tests first',
    ]);
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

    const days = doneRowsOf({ model, source: null, costs: NO_COSTS });

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
    expect(rows[0]?.by).toBe('2 steps');
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
    expect(rows[0]?.detail.auto?.children).toHaveLength(2);
  });

  it('keeps a running Auto tree out of the list', () => {
    const view = aView({ phase: 'waiting' });
    const root = done({ id: FIXTURE_ROOT, kind: 'auto', name: 'Keep the retries green' });

    expect(rowsOf(modelOf({ agents: [root], autoTrees: [view] }))).toEqual([]);
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

  it('reads duration and cost from their owners', () => {
    const agent = done({ id: brandId<AgentId>({ value: 'scribe' }), kind: 'scribe' });
    const span: MeasuredTurnSpan = {
      agentId: agent.id,
      parentAgentId: null,
      agentStatus: 'completed',
      workflowRunId: null,
      isOrchestratedRunDone: false,
      stepRole: 'scribe',
      provider: 'anthropic',
      model: 'claude-opus-5-5',
      effort: 'high',
      startedAtMs: new Date(at({ hour: 9 })).getTime(),
      endedAtMs: new Date(at({ hour: 9, minute: 12 })).getTime(),
      endReason: 'succeeded',
      costUsd: 0.4,
      touchedMountIds: null,
    };
    const source: WorkTimeSource = {
      nowMs: NOW.getTime(),
      spans: [span],
      history: null,
      liveStartMs: new Map(),
      childrenOf: new Map(),
    };
    const costs: DoneCosts = {
      byAgentId: new Map([[agent.id, 0.4]]),
      byRunId: new Map(),
    };

    const [row] = doneRowsOf({ model: modelOf({ agents: [agent] }), source, costs }).flatMap(
      (day) => day.rows,
    );

    const owned = agentWorkTime({
      agentId: agent.id,
      key: estimateKeyOf({
        role: KIND_TO_ROLE.scribe,
        provider: null,
        model: null,
        effort: null,
        size: null,
      }),
      unit: 'turn',
      phase: 'done',
      source,
    });
    expect(row?.detail.duration).toBe(owned?.label);
    expect(row?.detail.duration).toBe('12m');
    expect(row?.detail.costUsd).toBe(costs.byAgentId.get(agent.id));
    expect(row?.detail.model).not.toBeNull();
  });
});

describe('doneRowsOf full text', () => {
  it('titles the row with the first step and keeps the whole summary for the detail', () => {
    const summary = 'apply fix -> verify tsc -> lint -> ready for push';
    const [row] = rowsOf(
      modelOf({ agents: [done({ kind: 'implementer', outputSummary: summary })] }),
    );

    expect(row?.title).toBe('apply fix');
    expect(row?.detail.fullText).toBe(summary);
  });

  it('keeps no full text when the title says it all or the summary is a recap', () => {
    const [plain] = rowsOf(
      modelOf({ agents: [done({ kind: 'implementer', outputSummary: 'Wrote the retry tests' })] }),
    );
    const [recap] = rowsOf(
      modelOf({
        agents: [
          done({
            kind: 'implementer',
            outputSummary: JSON.stringify({ done: ['Wrote the tests'] }),
          }),
        ],
      }),
    );

    expect(plain?.detail.fullText).toBeNull();
    expect(recap?.title).toBe('Wrote the tests');
    expect(recap?.detail.fullText).toBeNull();
  });
});
