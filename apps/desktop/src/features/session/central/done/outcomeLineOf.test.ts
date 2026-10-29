// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type AgentId, type ProviderRunId } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import { declaredOutcomeLineOf } from '../../../auto/testing/autoViewFixtures';
import { AGENT_KIND_ORDER } from '../../agent-kind';
import {
  aDelegation,
  aView,
  FIXTURE_ROOT,
  FIXTURE_SESSION,
} from '../../../auto/testing/autoViewFixtures';
import { outcomeLineOf } from './outcomeLineOf';
import { at, eventOf, modelOf, sourceOf, stepAgent, workflowOf } from './testing/doneFixtures';

const done = (overrides: Parameters<typeof anAgent>[0] = {}) =>
  anAgent({
    sessionId: FIXTURE_SESSION,
    status: 'completed',
    startedAt: at({ hour: 9 }),
    completedAt: at({ hour: 9, minute: 20 }),
    ...overrides,
  });

const lineOfAgent = ({
  agent,
  checkNames = new Map<string, string>(),
  events = [],
}: {
  readonly agent: ReturnType<typeof anAgent>;
  readonly checkNames?: ReadonlyMap<string, string>;
  readonly events?: Parameters<typeof modelOf>[0]['events'];
}) => {
  const model = modelOf({ agents: [agent], checkNameByAgentId: checkNames, events });
  return outcomeLineOf({ entry: sourceOf({ model, id: `agent:${agent.id}` }), model });
};

describe('outcomeLineOf for an agent', () => {
  it('cuts the output summary to its first sentence and names the role', () => {
    const line = lineOfAgent({
      agent: done({
        id: brandId<AgentId>({ value: 'a1' }),
        kind: 'reviewer',
        name: 'run-7f3',
        outputSummary: 'Found 2 doc mismatches. The second one is in the payout table.',
      }),
    });

    expect(line).toEqual({ title: 'Found 2 doc mismatches', by: 'Reviewer' });
  });

  it('cuts a chained agent summary to its first step', () => {
    const line = lineOfAgent({
      agent: done({
        kind: 'ci-fixer',
        outputSummary: 'apply fix -> verify tsc -> lint -> ready for push',
      }),
    });

    expect(line.title).toBe('apply fix');
  });

  it('never shows raw JSON as a title and uses the kind fallback', () => {
    const line = lineOfAgent({
      agent: done({ kind: 'tester', outputSummary: '{"left":[],"unknown":true}' }),
    });

    expect(line.title).toBe('Tester finished');
  });

  it('never shows the internal name when an outcome exists', () => {
    const line = lineOfAgent({
      agent: done({
        kind: 'tester',
        name: 'run-7f3',
        outputSummary: 'Wrote the retry tests\nmore',
      }),
    });

    expect(line.title).toBe('Wrote the retry tests');
  });

  it('falls back to Summarised the plan for a Scribe', () => {
    expect(lineOfAgent({ agent: done({ kind: 'scribe', name: 'x' }) })).toEqual({
      title: 'Summarised the plan',
      by: 'Scribe',
    });
  });

  it('falls back to Planned the change for a planner', () => {
    expect(lineOfAgent({ agent: done({ kind: 'planner', name: 'x' }) }).title).toBe(
      'Planned the change',
    );
  });

  it('falls back to Rebased on the base for a rebase agent', () => {
    const agent = done({ id: brandId<AgentId>({ value: 'rebaser' }), kind: 'rewriter' });
    const line = lineOfAgent({
      agent,
      events: [
        eventOf({
          id: 'e1',
          kind: 'rebase_requested',
          payload: { branch: 'main', agentId: 'rebaser' },
          createdAt: at({ hour: 9, minute: 5 }),
        }),
      ],
    });

    expect(line).toEqual({ title: 'Rebased on main', by: 'Rebase' });
  });

  it('names the failing check for a check fix, and drops the name when unknown', () => {
    const agent = done({ id: brandId<AgentId>({ value: 'fixer' }), kind: 'ci-fixer' });

    expect(lineOfAgent({ agent, checkNames: new Map([['fixer', 'static-analysis']]) })).toEqual({
      title: 'Fixed the failing static-analysis check',
      by: 'Check fix',
    });
    expect(lineOfAgent({ agent }).title).toBe('Fixed the failing check');
  });

  it('says the role finished for a plain agent', () => {
    expect(lineOfAgent({ agent: done({ kind: 'implementer', name: 'x' }) }).title).toBe(
      'Implementer finished',
    );
  });

  it('has a title for every agent kind that is not the internal name', () => {
    for (const kind of AGENT_KIND_ORDER) {
      const line = lineOfAgent({ agent: done({ kind, name: 'run-7f3' }) });

      expect(line.title, kind).not.toBe('');
      expect(line.title, kind).not.toBe('run-7f3');
    }
  });
});

describe('outcomeLineOf for an Auto tree', () => {
  const autoAgent = done({
    id: FIXTURE_ROOT,
    kind: 'auto',
    name: 'Keep the payments-api retries green',
  });

  const delivered = ({ key, summary }: { readonly key: string; readonly summary: string }) => ({
    runId: brandId<ProviderRunId>({ value: `run-${key}` }),
    delegationId: `delegation-${key}`,
    childAgentId: brandId<AgentId>({ value: `agent-${key}` }),
    role: 'implementer',
    provider: null,
    model: null,
    outcome: 'completed' as const,
    summary,
    outcomeLine: declaredOutcomeLineOf({ summary, outcome: 'completed' }),
    artifacts: [],
  });

  const lineOfTree = ({
    keys,
    own,
  }: {
    readonly keys: ReadonlyArray<string>;
    readonly own?: string;
  }) => {
    const agent = own === undefined ? autoAgent : { ...autoAgent, outputSummary: own };
    const view = aView({
      phase: 'done',
      delegations: keys.map((key, slot) => ({
        ...aDelegation({
          key,
          role: key === 'reviewer' ? 'reviewer' : 'implementer',
          state: 'settled',
          outcome: 'completed',
        }),
        slot,
      })),
      deliveredResults: keys.map((key) =>
        delivered({ key, summary: `Delivered by ${key}. Extra.` }),
      ),
    });
    const model = modelOf({ agents: [agent], autoTrees: [view] });
    return outcomeLineOf({ entry: sourceOf({ model, id: `agent:${FIXTURE_ROOT}` }), model });
  };

  it('uses the delivered summary when there was one child', () => {
    expect(lineOfTree({ keys: ['fixer'] })).toEqual({ title: 'Delivered by fixer', by: 'Auto' });
  });

  it('uses the Auto agent summary for several children', () => {
    expect(lineOfTree({ keys: ['reviewer', 'fixer'], own: 'Retries are green again.' }).title).toBe(
      'Retries are green again',
    );
  });

  it('counts the agents and names the roles when nothing else was said', () => {
    expect(lineOfTree({ keys: ['reviewer', 'fixer'] }).title).toBe(
      '2 agents finished: Reviewer and Implementer',
    );
  });
});

describe('outcomeLineOf for a run', () => {
  const liveWorld = ({
    total,
    finished,
  }: {
    readonly total: number;
    readonly finished: number;
  }) => {
    const steps = Array.from({ length: finished }, (_, offset) =>
      stepAgent({ index: offset + 1, summary: `Result of step ${offset + 1}. Details.` }),
    );
    return modelOf({ agents: steps, runs: [workflowOf({ total })] });
  };

  it('names the steps of a live run slice with the total', () => {
    const model = liveWorld({ total: 6, finished: 2 });
    const entry = sourceOf({ model, id: 'run:run-build' });
    const slice =
      entry.kind === 'run' ? entry.children.flatMap((c) => (c.kind === 'agent' ? [c] : [])) : [];

    expect(outcomeLineOf({ entry, model, slice })).toEqual({
      title: 'Result of step 2',
      by: 'Build · steps 1 and 2 of 6',
    });
  });

  it('says steps 1 to 3 without a total for an orchestrated run', () => {
    const steps = [1, 2, 3].map((index) => stepAgent({ index, summary: `Mapped part ${index}.` }));
    const model = modelOf({
      agents: steps,
      runs: [workflowOf({ total: 3, isOrchestrated: true })],
    });
    const entry = sourceOf({ model, id: 'run:run-build' });
    const slice =
      entry.kind === 'run' ? entry.children.flatMap((c) => (c.kind === 'agent' ? [c] : [])) : [];

    expect(outcomeLineOf({ entry, model, slice }).by).toBe('Orchestrated · steps 1 to 3');
  });

  it('uses the run recap of a finished orchestrated run and the step count as the sub line', () => {
    const steps = [1, 2].map((index) => stepAgent({ index, summary: `Mapped part ${index}.` }));
    const model = modelOf({
      agents: steps,
      runs: [
        workflowOf({
          total: 2,
          isOrchestrated: true,
          summary: 'Mapped the payout code. Wrote a plan.',
        }),
      ],
    });

    expect(outcomeLineOf({ entry: sourceOf({ model, id: 'run:run-build' }), model })).toEqual({
      title: 'Mapped the payout code',
      by: '2 steps',
    });
  });

  it('takes the first done line of the recap the orchestrator writes, never the raw JSON', () => {
    const steps = [1, 2].map((index) => stepAgent({ index, summary: `Mapped part ${index}.` }));
    const model = modelOf({
      agents: steps,
      runs: [
        workflowOf({
          total: 2,
          isOrchestrated: true,
          summary: JSON.stringify({
            done: ['Batched the row reads in payments-api', 'Wrote the export notes'],
            left: [{ text: 'Stream rows to CSV', role: 'implementer' }],
          }),
        }),
      ],
    });

    expect(outcomeLineOf({ entry: sourceOf({ model, id: 'run:run-build' }), model }).title).toBe(
      'Batched the row reads in payments-api',
    );
  });

  it('falls back to the last step when the recap has no done line', () => {
    const steps = [1, 2].map((index) => stepAgent({ index, summary: `Mapped part ${index}.` }));
    const model = modelOf({
      agents: steps,
      runs: [
        workflowOf({
          total: 2,
          isOrchestrated: true,
          summary: JSON.stringify({ done: [], left: ['Stream rows to CSV'] }),
        }),
      ],
    });

    expect(outcomeLineOf({ entry: sourceOf({ model, id: 'run:run-build' }), model }).title).toBe(
      'Mapped part 2',
    );
  });

  it('uses the last step summary and the steps summary for a finished static run', () => {
    const model = liveWorld({ total: 2, finished: 2 });

    expect(outcomeLineOf({ entry: sourceOf({ model, id: 'run:run-build' }), model })).toEqual({
      title: 'Result of step 2',
      by: '2 steps',
    });
  });
});

describe('outcomeLineOf for a rebase event', () => {
  it('says Rebased on the requested base', () => {
    const events = [
      eventOf({
        id: 'ask',
        kind: 'rebase_requested',
        payload: { branch: 'main' },
        createdAt: at({ hour: 9 }),
      }),
      eventOf({
        id: 'done',
        kind: 'history_rewritten',
        payload: { origin: 'rebase', branch: 'hl/fix' },
        createdAt: at({ hour: 9, minute: 12 }),
      }),
    ];
    const model = modelOf({ events });

    expect(outcomeLineOf({ entry: sourceOf({ model, id: 'event:done' }), model })).toEqual({
      title: 'Rebased on main',
      by: 'Rebase',
    });
  });
});
