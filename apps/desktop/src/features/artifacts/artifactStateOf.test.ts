// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type {
  Agent,
  AgentId,
  ArtifactId,
  IsoDateTime,
  PlanWithCount,
  SessionId,
} from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import { planPartRows } from '../plans/components/PlanParts/planPartRows';
import { planStateInputsOf } from '../plans/planStateInputs';
import type { ArtifactGeneration } from './artifactCollection';
import { buildArtifactListRows } from './artifactListRows';
import { artifactStateOf, generationStateOf } from './artifactStateOf';

const SESSION_ID = 'session-1' as SessionId;
const NO_ASKING: ReadonlySet<AgentId> = new Set();
const NOW = '2026-09-14T16:40:00.000Z' as IsoDateTime;

const NO_PLAN = { openQuestionCount: 0, partCount: 0, progress: null, hasPartAgents: false };

const stored = (params: {
  readonly kind: 'plan' | 'report' | 'wireframe';
  readonly status: 'active' | 'consumed' | 'superseded' | 'discarded';
  readonly isNew?: boolean;
}) => artifactStateOf({ ...NO_PLAN, isNew: false, ...params });

describe('artifactStateOf', () => {
  it.each([
    ['plan', 'active', 'Ready to run', 'ready'],
    ['plan', 'consumed', 'Ran', 'ran'],
    ['plan', 'superseded', 'Replaced', 'ran'],
    ['plan', 'discarded', 'Deleted', 'deleted'],
    ['report', 'superseded', 'Replaced', 'ran'],
    ['report', 'discarded', 'Deleted', 'deleted'],
    ['wireframe', 'superseded', 'Replaced', 'ran'],
    ['wireframe', 'discarded', 'Deleted', 'deleted'],
  ] as const)('%s %s reads %s in the %s group', (kind, status, label, group) => {
    const state = stored({ kind, status });
    expect([state?.label, state?.group]).toEqual([label, group]);
  });

  it('puts a plan with open questions under Needs you', () => {
    const state = artifactStateOf({
      ...NO_PLAN,
      kind: 'plan',
      status: 'active',
      isNew: false,
      openQuestionCount: 1,
    });
    expect(state).toMatchObject({ key: 'needs', detail: '1 question', group: 'needs' });
  });

  it.each([
    [{ kind: 'running', part: 2, total: 3 }, 'Running', 'part 2 of 3'],
    [{ kind: 'question', part: 1, total: 3 }, 'Needs you', 'part 1'],
    [{ kind: 'failed', part: 2, total: 3 }, 'Partly ran', 'part 2 failed'],
    [{ kind: 'waiting', done: 1, total: 3 }, 'Partly ran', '1 of 3 parts'],
    [{ kind: 'done', total: 3 }, 'Ran', '3 parts'],
    [{ kind: 'notRun', total: 3 }, 'Ran', '3 parts'],
  ] as const)('reads a plan that ran from its parts: %j', (progress, label, detail) => {
    const state = artifactStateOf({
      ...NO_PLAN,
      kind: 'plan',
      status: 'consumed',
      isNew: false,
      partCount: 3,
      progress,
      hasPartAgents: true,
    });
    expect([state?.label, state?.detail]).toEqual([label, detail]);
  });

  it('falls back to Ran when the subagents of a half-finished plan are gone', () => {
    const state = artifactStateOf({
      ...NO_PLAN,
      kind: 'plan',
      status: 'consumed',
      isNew: false,
      partCount: 3,
      progress: { kind: 'waiting', done: 0, total: 3 },
      hasPartAgents: false,
    });
    expect(state?.label).toBe('Ran');
  });

  it('shows New for a report or wireframe nobody opened, then Ready', () => {
    expect(stored({ kind: 'report', status: 'active', isNew: true })).toMatchObject({
      key: 'new',
      detail: 'Report',
    });
    expect(stored({ kind: 'wireframe', status: 'active', isNew: true })?.detail).toBe('Wireframe');
    expect(stored({ kind: 'report', status: 'active', isNew: false })).toMatchObject({
      key: 'available',
      label: 'Ready',
      detail: 'Report',
      group: 'ready',
    });
    expect(stored({ kind: 'wireframe', status: 'consumed', isNew: false })?.label).toBe('Ready');
  });

  it('gives every state a sentence-case word', () => {
    const states = [
      ...(['plan', 'report', 'wireframe'] as const).flatMap((kind) =>
        (['active', 'consumed', 'superseded', 'discarded'] as const).map((status) =>
          artifactStateOf({ ...NO_PLAN, kind, status, isNew: true }),
        ),
      ),
      artifactStateOf({
        ...NO_PLAN,
        kind: 'plan',
        status: 'active',
        isNew: false,
        openQuestionCount: 1,
      }),
      artifactStateOf({
        ...NO_PLAN,
        kind: 'plan',
        status: 'consumed',
        isNew: false,
        progress: { kind: 'running', part: 1, total: 2 },
        hasPartAgents: true,
      }),
      artifactStateOf({
        ...NO_PLAN,
        kind: 'plan',
        status: 'consumed',
        isNew: false,
        progress: { kind: 'failed', part: 1, total: 2 },
        hasPartAgents: true,
      }),
    ];
    const labels = states.flatMap((state) => (state === null ? [] : [state.label]));
    expect(labels.filter((label) => !/^[A-Z]/.test(label))).toEqual([]);
    expect(new Set(labels)).toEqual(
      new Set([
        'Ready to run',
        'Ran',
        'Replaced',
        'Deleted',
        'New',
        'Needs you',
        'Running',
        'Partly ran',
      ]),
    );
  });
});

describe('generationStateOf', () => {
  const generation = (overrides: Partial<ArtifactGeneration>): ArtifactGeneration => ({
    agentId: 'agent-report' as AgentId,
    kind: 'report',
    title: 'Session summary',
    state: 'generating',
    startedAt: NOW,
    provider: null,
    model: null,
    isTurnRunning: true,
    scouts: [],
    canStop: true,
    ...overrides,
  });

  it.each([
    ['generating', 'Running'],
    ['waiting', 'Needs you'],
    ['unproduced', 'Stopped'],
  ] as const)('reads %s as %s', (state, label) => {
    expect(generationStateOf({ generation: generation({ state }) }).label).toBe(label);
  });
});

describe('the list and the document agree', () => {
  const agent = (id: string, overrides: Partial<Agent>): Agent =>
    anAgent({ id: id as AgentId, sessionId: SESSION_ID, name: id, ...overrides });

  const plan = (overrides: Partial<PlanWithCount>): PlanWithCount => ({
    id: 'plan-1' as ArtifactId,
    sessionId: SESSION_ID,
    agentId: 'agent-planner' as AgentId,
    title: 'Backfill the settled batches',
    bodyMd: '## Goal',
    status: 'active',
    createdAt: NOW,
    updatedAt: NOW,
    consumptionCount: 0,
    clusters: [
      { title: 'add a dry run', instructions: 'a' },
      { title: 'backfill behind a flag', instructions: 'b' },
    ],
    ...overrides,
  });

  const ran = {
    status: 'consumed',
    consumptionCount: 1,
    lastConsumer: { agentId: 'agent-impl' as AgentId, name: 'Implementer 3' },
  } as const;

  const implementer = agent('agent-impl', { status: 'completed', ordinal: 3 });
  const part = (index: number, status: Agent['status']) =>
    agent(`agent-part-${index}`, {
      parentAgentId: 'agent-impl' as AgentId,
      ordinal: 3 + index,
      status,
    });

  it.each([
    ['ready', plan({}), []],
    ['replaced', plan({ status: 'superseded' }), []],
    ['deleted', plan({ status: 'discarded' }), []],
    ['ran, every part done', plan(ran), [implementer, part(1, 'completed'), part(2, 'completed')]],
    [
      'ran, second part running',
      plan(ran),
      [implementer, part(1, 'completed'), part(2, 'running')],
    ],
    ['ran, stopped after the first', plan(ran), [implementer, part(1, 'completed')]],
    ['ran, subagents gone', plan(ran), []],
  ] as const)('%s', (_name, planFixture, agents) => {
    const [row] = buildArtifactListRows({
      plans: [planFixture],
      artifacts: [],
      generations: [],
      agents,
      openQuestionCount: 0,
      askingAgentIds: NO_ASKING,
      now: Date.parse(NOW),
    });
    const rows = planPartRows({ plan: planFixture, agents, askingAgentIds: NO_ASKING });
    const documentState = artifactStateOf({
      kind: 'plan',
      status: planFixture.status,
      isNew: false,
      openQuestionCount: 0,
      ...planStateInputsOf({ plan: planFixture, rows }),
    });
    expect(row?.state).toEqual(documentState);
  });
});
