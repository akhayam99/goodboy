// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type {
  Agent,
  AgentId,
  ArtifactId,
  IsoDateTime,
  PlanWithCount,
  SessionArtifact,
  SessionId,
} from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import type { ArtifactGeneration } from './artifactCollection';
import {
  buildArtifactListRows,
  countArtifactRows,
  filterArtifactRows,
  groupArtifactRows,
} from './artifactListRows';

const SESSION_ID = 'session-1' as SessionId;
const NO_ASKING: ReadonlySet<AgentId> = new Set();
const NOW = Date.parse('2026-09-14T19:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

const agent = (id: string, name: string, overrides: Partial<Agent> = {}): Agent =>
  anAgent({ id: id as AgentId, sessionId: SESSION_ID, name, ...overrides });

const plan = (overrides: Partial<PlanWithCount>): PlanWithCount => ({
  id: 'plan-1' as ArtifactId,
  sessionId: SESSION_ID,
  agentId: 'agent-planner' as AgentId,
  title: 'Backfill the settled batches',
  bodyMd: '## Goal',
  status: 'active',
  createdAt: '2026-09-14T19:34:00.000Z' as IsoDateTime,
  updatedAt: '2026-09-14T19:34:00.000Z' as IsoDateTime,
  consumptionCount: 0,
  ...overrides,
});

const report = (overrides: Partial<SessionArtifact>): SessionArtifact =>
  ({
    id: 'report-1' as ArtifactId,
    sessionId: SESSION_ID,
    agentId: 'agent-report' as AgentId,
    workflowRunId: null,
    kind: 'report',
    schemaVersion: 1,
    title: 'Rounding drift in ledger-core postings',
    sourceFormat: 'markdown',
    sourceText: '## What was wrong',
    metadata: { reportType: 'session-summary' },
    status: 'active',
    revision: 2,
    sourceTurnId: null,
    createdAt: '2026-09-14T18:27:00.000Z' as IsoDateTime,
    updatedAt: '2026-09-14T18:27:00.000Z' as IsoDateTime,
    openedAt: '2026-09-14T18:40:00.000Z' as IsoDateTime,
    ...overrides,
  }) as SessionArtifact;

const generation = (overrides: Partial<ArtifactGeneration>): ArtifactGeneration => ({
  agentId: 'agent-wireframe' as AgentId,
  kind: 'wireframe',
  title: 'Wireframe 2',
  state: 'generating',
  startedAt: '2026-09-14T18:39:00.000Z' as IsoDateTime,
  provider: null,
  model: null,
  isTurnRunning: true,
  scouts: [],
  canStop: true,
  ...overrides,
});

const AGENTS = [agent('agent-planner', 'Planner 2'), agent('agent-report', 'Report 1')];

const build = (params: {
  readonly plans?: ReadonlyArray<PlanWithCount>;
  readonly artifacts?: ReadonlyArray<SessionArtifact>;
  readonly generations?: ReadonlyArray<ArtifactGeneration>;
  readonly agents?: ReadonlyArray<Agent>;
  readonly openQuestionCount?: number;
}) =>
  buildArtifactListRows({
    plans: params.plans ?? [],
    artifacts: params.artifacts ?? [],
    generations: params.generations ?? [],
    agents: params.agents ?? AGENTS,
    openQuestionCount: params.openQuestionCount ?? 0,
    askingAgentIds: NO_ASKING,
    now: NOW,
  });

describe('buildArtifactListRows', () => {
  it('puts every kind in one list, newest first', () => {
    const rows = build({
      plans: [plan({})],
      artifacts: [report({})],
      generations: [generation({})],
    });
    expect(rows.map((row) => row.title)).toEqual([
      'Backfill the settled batches',
      'Wireframe 2',
      'Rounding drift in ledger-core postings',
    ]);
  });

  it('says a ready plan is the next click and counts its parts', () => {
    const [row] = build({
      plans: [
        plan({
          clusters: [
            { title: 'add a dry run', instructions: 'a' },
            { title: 'backfill behind a flag', instructions: 'b' },
          ],
        }),
      ],
    });
    expect(row?.state).toMatchObject({ key: 'ready', label: 'Ready to run', detail: '2 parts' });
    expect(row?.group).toBe('ready');
  });

  it('says a plan with open questions needs you', () => {
    const [row] = build({ plans: [plan({})], openQuestionCount: 2 });
    expect(row?.state).toMatchObject({ key: 'needs', detail: '2 questions' });
    expect(row?.isPlanRunning).toBe(true);
  });

  it('says how far a plan that ran got, from the subagents that carry its parts', () => {
    const [row] = build({
      plans: [
        plan({
          status: 'consumed',
          consumptionCount: 1,
          lastConsumer: { agentId: 'agent-impl' as AgentId, name: 'Implementer 3' },
          clusters: [
            { title: 'add a dry run', instructions: 'a' },
            { title: 'backfill behind a flag', instructions: 'b' },
          ],
        }),
      ],
      agents: [
        ...AGENTS,
        agent('agent-impl', 'Implementer 3', { status: 'running', ordinal: 3 }),
        agent('agent-part-1', 'add a dry run', {
          parentAgentId: 'agent-impl' as AgentId,
          ordinal: 4,
          status: 'completed',
        }),
        agent('agent-part-2', 'backfill behind a flag', {
          parentAgentId: 'agent-impl' as AgentId,
          ordinal: 5,
          status: 'running',
        }),
      ],
    });
    expect(row?.state).toMatchObject({ key: 'running', detail: 'part 2 of 2' });
    expect(row?.group).toBe('running');
    expect(row?.runBy).toBe('Run by Implementer 3');
  });

  it('calls a plan that stopped halfway partly ran, and a plan whose subagents are gone ran', () => {
    const stopped = plan({
      status: 'consumed',
      consumptionCount: 1,
      lastConsumer: { agentId: 'agent-impl' as AgentId, name: 'Implementer 3' },
      clusters: [
        { title: 'add a dry run', instructions: 'a' },
        { title: 'backfill behind a flag', instructions: 'b' },
      ],
    });
    const implementer = agent('agent-impl', 'Implementer 3', { status: 'completed', ordinal: 3 });
    const firstPart = agent('agent-part-1', 'add a dry run', {
      parentAgentId: 'agent-impl' as AgentId,
      ordinal: 4,
      status: 'completed',
    });
    const [partly] = build({ plans: [stopped], agents: [implementer, firstPart] });
    const [gone] = build({ plans: [stopped], agents: AGENTS });
    expect(partly?.state).toMatchObject({ key: 'partly', label: 'Partly ran' });
    expect(gone?.state).toMatchObject({ key: 'ran', label: 'Ran' });
  });

  it('marks a fresh report nobody opened as New, and every other report as Ready', () => {
    const [fresh] = build({ artifacts: [report({ openedAt: null })] });
    const [opened] = build({ artifacts: [report({})] });
    expect(fresh?.state).toMatchObject({ key: 'new', label: 'New', detail: 'Report' });
    expect(opened?.state).toMatchObject({ key: 'available', label: 'Ready', detail: 'Report' });
    expect(opened?.group).toBe('ready');
  });

  it('does not call an old artifact New just because it was never opened', () => {
    const old = new Date(NOW - 3 * DAY_MS).toISOString() as IsoDateTime;
    const justUnder = new Date(NOW - DAY_MS + 60_000).toISOString() as IsoDateTime;
    const [stale, recent] = build({
      artifacts: [
        report({ id: 'old' as ArtifactId, openedAt: null, createdAt: old }),
        report({ id: 'recent' as ArtifactId, openedAt: null, createdAt: justUnder }),
      ],
    });
    expect([stale, recent].map((row) => row?.state?.label).sort()).toEqual(['New', 'Ready']);
  });

  it('sends a deleted artifact of any kind to Recently deleted, most recent first', () => {
    const rows = build({
      plans: [
        plan({
          id: 'plan-old' as ArtifactId,
          title: 'First draft',
          status: 'discarded',
          updatedAt: '2026-09-15T08:00:00.000Z' as IsoDateTime,
        }),
      ],
      artifacts: [
        report({
          status: 'discarded',
          updatedAt: '2026-09-16T08:00:00.000Z' as IsoDateTime,
        }),
      ],
    });
    expect(groupArtifactRows({ rows })).toEqual([expect.objectContaining({ group: 'deleted' })]);
    expect(rows.map((row) => [row.title, row.state?.key, row.isFaint])).toEqual([
      ['Rounding drift in ledger-core postings', 'deleted', true],
      ['First draft', 'deleted', true],
    ]);
  });

  it('files a replaced report under Ran, faint', () => {
    const [row] = build({ artifacts: [report({ status: 'superseded' })] });
    expect(row).toMatchObject({ group: 'ran', isFaint: true });
    expect(row?.state?.label).toBe('Replaced');
  });

  it('shows a running generation with its scouts and a failed one as stopped', () => {
    const rows = build({
      generations: [
        generation({
          scouts: [
            {
              agentId: 'scout-1' as AgentId,
              name: 'Scout 1',
              state: 'done',
              detail: null,
              claims: null,
            },
            {
              agentId: 'scout-2' as AgentId,
              name: 'Scout 2',
              state: 'running',
              detail: null,
              claims: null,
            },
          ],
        }),
        generation({
          agentId: 'agent-report-2' as AgentId,
          kind: 'report',
          title: 'Report 2',
          state: 'unproduced',
          startedAt: '2026-09-14T10:00:00.000Z' as IsoDateTime,
          canStop: false,
        }),
      ],
    });
    expect(rows.map((row) => [row.state?.label, row.state?.detail, row.group])).toEqual([
      ['Running', '1 of 2 scouts done', 'running'],
      ['Stopped', 'No report', 'needs'],
    ]);
  });

  it('groups in the order Needs you, Ready, Running, Ran, Recently deleted', () => {
    const rows = build({
      plans: [
        plan({ id: 'p-ready' as ArtifactId, title: 'Ready plan' }),
        plan({ id: 'p-ran' as ArtifactId, title: 'Ran plan', status: 'consumed' }),
        plan({ id: 'p-del' as ArtifactId, title: 'Deleted plan', status: 'discarded' }),
      ],
      generations: [generation({ state: 'waiting' })],
    });
    expect(groupArtifactRows({ rows }).map((entry) => entry.group)).toEqual([
      'needs',
      'ready',
      'ran',
      'deleted',
    ]);
  });

  it('filters by kind and counts only what is not deleted', () => {
    const rows = build({
      plans: [plan({}), plan({ id: 'plan-2' as ArtifactId, status: 'discarded' })],
      artifacts: [report({})],
      generations: [generation({})],
    });
    expect(filterArtifactRows({ rows, filter: 'report' }).map((row) => row.kind)).toEqual([
      'report',
    ]);
    expect(countArtifactRows({ rows })).toEqual({ all: 3, plan: 1, report: 1, wireframe: 1 });
  });
});
