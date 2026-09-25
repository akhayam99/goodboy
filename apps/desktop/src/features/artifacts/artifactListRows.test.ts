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
import type { ArtifactGeneration } from './artifactCollection';
import { buildArtifactListRows, countArtifactRows, filterArtifactRows } from './artifactListRows';

const SESSION_ID = 'session-1' as SessionId;

const agent = (id: string, name: string): Agent =>
  ({ id: id as AgentId, name, kind: 'planner', status: 'completed' }) as unknown as Agent;

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

describe('buildArtifactListRows', () => {
  it('puts every kind in one list, newest first', () => {
    const rows = buildArtifactListRows({
      plans: [plan({})],
      artifacts: [report({})],
      generations: [generation({})],
      agents: AGENTS,
      openQuestionCount: 0,
    });
    expect(rows.map((row) => row.title)).toEqual([
      'Backfill the settled batches',
      'Wireframe 2',
      'Rounding drift in ledger-core postings',
    ]);
  });

  it('keeps replaced and discarded artifacts at the bottom, faint, whatever their age', () => {
    const rows = buildArtifactListRows({
      plans: [
        plan({ id: 'plan-old' as ArtifactId, title: 'First draft', status: 'discarded' }),
        plan({
          id: 'plan-new' as ArtifactId,
          title: 'Move allocation to batch level',
          status: 'consumed',
          createdAt: '2026-09-14T16:05:00.000Z' as IsoDateTime,
        }),
      ],
      artifacts: [
        report({ status: 'superseded', createdAt: '2026-09-15T08:00:00.000Z' as IsoDateTime }),
      ],
      generations: [],
      agents: AGENTS,
      openQuestionCount: 0,
    });
    expect(rows.map((row) => [row.title, row.isFaint])).toEqual([
      ['Move allocation to batch level', false],
      ['Rounding drift in ledger-core postings', true],
      ['First draft', true],
    ]);
  });

  it('says a ready plan is the next click and counts its parts', () => {
    const [row] = buildArtifactListRows({
      plans: [
        plan({
          clusters: [
            { title: 'add a dry run', instructions: 'a' },
            { title: 'backfill behind a flag', instructions: 'b' },
          ],
        }),
      ],
      artifacts: [],
      generations: [],
      agents: AGENTS,
      openQuestionCount: 0,
    });
    expect(row).toMatchObject({
      node: 'ready',
      sentence: 'Ready to run · 2 parts',
      sentenceTone: 'warning',
      author: 'Planner 2',
    });
  });

  it('says how far a plan that ran got, from the subagents that carry its parts', () => {
    const [row] = buildArtifactListRows({
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
      artifacts: [],
      generations: [],
      agents: [
        ...AGENTS,
        { ...agent('agent-impl', 'Implementer 3'), status: 'running', ordinal: 3 } as Agent,
        {
          ...agent('agent-part-1', 'add a dry run'),
          parentAgentId: 'agent-impl',
          ordinal: 4,
        } as unknown as Agent,
        {
          ...agent('agent-part-2', 'backfill behind a flag'),
          parentAgentId: 'agent-impl',
          status: 'running',
          ordinal: 5,
        } as unknown as Agent,
      ],
      openQuestionCount: 0,
    });
    expect(row).toMatchObject({
      node: 'running',
      sentence: 'Running part 2 of 2',
      sentenceTone: 'info',
    });
  });

  it('gives a report at rest a neutral marker and its report type', () => {
    const [row] = buildArtifactListRows({
      plans: [],
      artifacts: [report({})],
      generations: [],
      agents: AGENTS,
      openQuestionCount: 0,
    });
    expect(row).toMatchObject({
      node: 'marker',
      sentence: 'Session summary',
      sentenceTone: 'neutral',
      revision: 2,
    });
  });

  it('shows a running generation with its scouts and a failed one with retry', () => {
    const rows = buildArtifactListRows({
      plans: [],
      artifacts: [],
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
      agents: AGENTS,
      openQuestionCount: 0,
    });
    expect(rows.map((row) => [row.node, row.sentence, row.action])).toEqual([
      ['running', '1 of 2 scouts done', 'stop'],
      ['failed', 'No report', 'retry'],
    ]);
  });

  it('filters by kind and counts every kind', () => {
    const rows = buildArtifactListRows({
      plans: [plan({})],
      artifacts: [report({})],
      generations: [generation({})],
      agents: AGENTS,
      openQuestionCount: 0,
    });
    expect(filterArtifactRows({ rows, filter: 'report' }).map((row) => row.kind)).toEqual([
      'report',
    ]);
    expect(countArtifactRows({ rows })).toEqual({ all: 3, plan: 1, report: 1, wireframe: 1 });
  });
});
