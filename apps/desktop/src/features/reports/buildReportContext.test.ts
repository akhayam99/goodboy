import { describe, expect, it } from 'vitest';
import type {
  Agent,
  AgentId,
  ArtifactId,
  IsoDateTime,
  ReportArtifact,
  Session,
  SessionEvent,
  SessionEventId,
  SessionId,
  TurnEvent,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';
import { buildReportContext, REPORT_CONTEXT_LIMITS } from './buildReportContext';

const SESSION_ID = 'session-1' as SessionId;
const AGENT_ID = 'agent-1' as AgentId;
const OTHER_AGENT_ID = 'agent-2' as AgentId;
const RUN_ID = 'run-1' as WorkflowRunId;
const NOW = '2026-09-15T10:00:00.000Z' as IsoDateTime;

const session: Session = {
  id: SESSION_ID,
  workspaceId: 'ws-1' as WorkspaceId,
  goal: 'ship the report role',
  state: { kind: 'idle', lastActivityAt: NOW },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
  permissionMode: 'default',
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: false,
  createdAt: NOW,
  updatedAt: NOW,
};

const agent = (overrides: Partial<Agent>): Agent => ({
  id: AGENT_ID,
  sessionId: SESSION_ID,
  ordinal: 0,
  name: 'implementer',
  status: 'completed',
  ...overrides,
});

const assistantTurn = ({ runId, delta }: { runId: string; delta: string }): TurnEvent => ({
  kind: 'assistant_text',
  runId: runId as TurnEvent['runId'],
  delta,
  at: NOW,
});

const reportArtifact = (overrides: Partial<ReportArtifact>): ReportArtifact => ({
  id: 'artifact-1' as ArtifactId,
  sessionId: SESSION_ID,
  agentId: AGENT_ID,
  workflowRunId: null,
  kind: 'report',
  schemaVersion: 1,
  title: 'Earlier report',
  sourceFormat: 'markdown',
  sourceText: 'body',
  metadata: { reportType: 'session-summary' },
  status: 'active',
  revision: 2,
  sourceTurnId: null,
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
});

const baseParams = {
  reportType: 'session-summary',
  session,
  agents: [agent({})],
  transcripts: {
    [AGENT_ID]: [
      assistantTurn({ runId: 'r1', delta: 'first turn' }),
      assistantTurn({ runId: 'r2', delta: 'landed ' }),
      assistantTurn({ runId: 'r2', delta: 'the change' }),
    ],
  },
  artifacts: [],
  events: [],
  scriptRuns: {},
  diff: null,
  workflowRunId: null,
  capturedAt: NOW,
} as const;

describe('buildReportContext', () => {
  it('keeps only the last assistant message per agent and cites the agent id', () => {
    const context = buildReportContext({ ...baseParams });
    expect(context.text).toContain('landed the change');
    expect(context.text).not.toContain('first turn');
    expect(context.sourceIds).toContain(AGENT_ID);
    expect(context.sourceIds).toContain(SESSION_ID);
  });

  it('states the capture time and that tool payloads are excluded', () => {
    const context = buildReportContext({ ...baseParams });
    expect(context.text).toContain(NOW);
    expect(context.text).toContain('not tool calls or tool output');
  });

  it('scopes agents to a workflow run when one is given', () => {
    const context = buildReportContext({
      ...baseParams,
      workflowRunId: RUN_ID,
      agents: [
        agent({ id: AGENT_ID, workflowRunId: RUN_ID, name: 'in-run' }),
        agent({ id: OTHER_AGENT_ID, ordinal: 1, name: 'standalone' }),
      ],
    });
    expect(context.text).toContain('in-run');
    expect(context.text).not.toContain('standalone');
    expect(context.sourceIds).toContain(RUN_ID);
  });

  it('redacts credentials found in agent output', () => {
    const context = buildReportContext({
      ...baseParams,
      transcripts: {
        [AGENT_ID]: [
          assistantTurn({
            runId: 'r1',
            delta: 'used ghp_abcdefghijklmnopqrstuvwxyz012345 and password: hunter2000',
          }),
        ],
      },
    });
    expect(context.text).not.toContain('ghp_abcdefghijklmnopqrstuvwxyz012345');
    expect(context.text).not.toContain('hunter2000');
    expect(context.text).toContain('[redacted]');
  });

  it('records truncation when an agent message exceeds the bound', () => {
    const long = 'x'.repeat(REPORT_CONTEXT_LIMITS.agentText + 200);
    const context = buildReportContext({
      ...baseParams,
      transcripts: { [AGENT_ID]: [assistantTurn({ runId: 'r1', delta: long })] },
    });
    expect(context.truncations.some((note) => note.includes('truncated'))).toBe(true);
    expect(context.text).toContain('## truncation');
  });

  it('summarizes the diff at the recorded commit ids', () => {
    const context = buildReportContext({
      ...baseParams,
      diff: {
        mountName: 'goodboy',
        baseBranch: 'main',
        headSha: 'abc1234',
        commits: [{ sha: 'abc1234', subject: 'feat: reports' }],
        additions: 12,
        deletions: 3,
        paths: ['apps/desktop/src/features/reports/index.ts'],
      },
    });
    expect(context.text).toContain('abc1234 feat: reports');
    expect(context.text).toContain('+12 -3');
  });

  it('says plainly when diff, checks and events are missing', () => {
    const context = buildReportContext({ ...baseParams });
    expect(context.text).toContain('no mount diff was available');
    expect(context.text).toContain('no script or test run outcome');
    expect(context.text).toContain('no session events were recorded');
  });

  it('redacts a credential an agent put in an artifact title', () => {
    const context = buildReportContext({
      ...baseParams,
      artifacts: [reportArtifact({ title: 'deploy notes password: hunter2000xyz' })],
    });
    expect(context.text).not.toContain('hunter2000xyz');
    expect(context.text).toContain('[redacted]');
  });

  it('redacts a credential carried by a commit subject', () => {
    const context = buildReportContext({
      ...baseParams,
      diff: {
        mountName: 'goodboy',
        baseBranch: 'main',
        headSha: 'abc1234',
        commits: [
          { sha: 'abc1234', subject: 'chore: rotate ghp_abcdefghijklmnopqrstuvwxyz012345' },
        ],
        additions: 1,
        deletions: 0,
        paths: [],
      },
    });
    expect(context.text).not.toContain('ghp_abcdefghijklmnopqrstuvwxyz012345');
    expect(context.text).toContain('[redacted]');
  });

  it('redacts a credential carried by an agent name', () => {
    const context = buildReportContext({
      ...baseParams,
      agents: [agent({ name: 'runner Authorization: Bearer abcdefghijklmnop' })],
    });
    expect(context.text).not.toContain('abcdefghijklmnop');
  });

  it('scopes artifacts to a workflow run when one is given', () => {
    const context = buildReportContext({
      ...baseParams,
      workflowRunId: RUN_ID,
      agents: [agent({ workflowRunId: RUN_ID })],
      artifacts: [
        reportArtifact({ id: 'artifact-1' as ArtifactId, workflowRunId: RUN_ID, title: 'in run' }),
        reportArtifact({ id: 'artifact-2' as ArtifactId, title: 'standalone artifact' }),
      ],
    });
    expect(context.text).toContain('artifact-1');
    expect(context.text).not.toContain('artifact-2');
    expect(context.sourceIds).not.toContain('artifact-2');
  });

  it('lists artifact revisions and script outcomes', () => {
    const artifact: ReportArtifact = {
      id: 'artifact-1' as ArtifactId,
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      workflowRunId: null,
      kind: 'report',
      schemaVersion: 1,
      title: 'Earlier report',
      sourceFormat: 'markdown',
      sourceText: 'body',
      metadata: { reportType: 'session-summary' },
      status: 'active',
      revision: 2,
      sourceTurnId: null,
      createdAt: NOW,
      updatedAt: NOW,
    };
    const event: SessionEvent = {
      id: 'event-1' as SessionEventId,
      sessionId: SESSION_ID,
      kind: 'pr_created',
      payload: null,
      createdAt: NOW,
    };
    const context = buildReportContext({
      ...baseParams,
      artifacts: [artifact],
      events: [event],
      scriptRuns: {
        's-1': {
          status: 'error',
          result: { stdout: '', stderr: '', exitCode: 1 },
          runId: 'x',
          startedAt: 0,
          name: 'test',
        },
      },
    });
    expect(context.text).toContain('report artifact-1 rev 2');
    expect(context.text).toContain('- test: error, exit 1');
    expect(context.text).toContain('pr_created');
    expect(context.sourceIds).toContain('artifact-1');
  });
});
