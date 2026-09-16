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
  WireframeArtifact,
  WorkspaceId,
} from '@goodboy/types';
import { ARTIFACT_BRIEF_CLIP_NOTE, ARTIFACT_BRIEF_LIMITS } from '../artifacts/artifactBrief';
import {
  SESSION_GOAL_CLIP_NOTE,
  SESSION_GOAL_LIMITS,
  sessionGoalText,
} from '../artifacts/sessionGoalText';
import { REDACTED } from '../../shared/utils/redactSecrets';
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

type WireframeArtifactParams = Readonly<{ sourceText?: string }>;

const wireframeArtifact = ({ sourceText }: WireframeArtifactParams): WireframeArtifact => ({
  ...reportArtifact({}),
  kind: 'wireframe',
  sourceFormat: 'json',
  metadata: { fidelity: 'low', designProfile: {} },
  sourceText:
    sourceText ??
    JSON.stringify({
      version: 1,
      initialScreenId: 'inbox',
      theme: { name: 'generic', font: 'sans', radius: 'md' },
      screens: [
        {
          id: 'inbox',
          title: 'Inbox',
          viewport: 'desktop',
          root: { id: 'open', kind: 'button', label: 'Open Detail' },
        },
        {
          id: 'detail',
          title: 'Session Detail',
          viewport: 'desktop',
          root: {
            id: 'back',
            kind: 'navigation',
            variant: 'top',
            items: [
              {
                id: 'back-inbox',
                label: 'Inbox',
                action: { type: 'navigate', toScreenId: 'inbox' },
              },
            ],
          },
        },
      ],
      transitions: [{ fromNodeId: 'open', toScreenId: 'detail', label: 'open detail' }],
    }),
});

const goalOf = ({ value }: { readonly value: string }) =>
  sessionGoalText({ slots: [{ key: 'goal', value, enabled: true }], session });

const baseParams = {
  reportType: 'session-summary',
  session,
  goal: sessionGoalText({ slots: [], session }),
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
  it('adds the explicit user request separately from the unchanged evidence pack', () => {
    const baseline = buildReportContext({ ...baseParams });
    const context = buildReportContext({
      ...baseParams,
      brief: '  explain the Harborline rollout risks\ninclude remaining checks  ',
    });
    expect(context.text).toBe(
      `# user request\n\nexplain the Harborline rollout risks\ninclude remaining checks\n\n${baseline.text}`,
    );
    expect(context.sourceIds).toEqual(baseline.sourceIds);
    expect(context.truncations).toEqual(baseline.truncations);
  });

  it('redacts credentials in the user request', () => {
    const context = buildReportContext({
      ...baseParams,
      brief: 'explain access with api_key=harborline-test-value',
    });
    expect(context.text).toContain('# user request\n\nexplain access with api_key=[redacted]');
    expect(context.text).not.toContain('harborline-test-value');
  });

  it.each([null, '', ' \n\t '])('keeps the default request for an empty brief (%j)', (brief) => {
    expect(buildReportContext({ ...baseParams, brief })).toEqual(
      buildReportContext({ ...baseParams }),
    );
  });

  it('notes a clipped brief in the truncation section', () => {
    const context = buildReportContext({
      ...baseParams,
      brief: 'Harborline '.repeat(REPORT_CONTEXT_LIMITS.total),
    });
    expect(context.truncations).toContain(ARTIFACT_BRIEF_CLIP_NOTE);
    expect(context.text).toContain(ARTIFACT_BRIEF_CLIP_NOTE);
    expect(
      context.text.split('# user request\n\n')[1]?.split('\n\n# evidence pack')[0],
    ).toHaveLength(ARTIFACT_BRIEF_LIMITS.chars);
  });

  it('reports its inventory with the same counts it wrote into the pack', () => {
    const context = buildReportContext({ ...baseParams });
    const agents = context.inventory.find((row) => row.id === 'agents');
    const excluded = context.inventory.find((row) => row.id === 'excluded');
    const size = context.inventory.find((row) => row.id === 'size');
    expect(agents?.summary).toContain('agents, last message of each up to 1200 characters');
    expect(excluded?.summary).toContain('tool calls');
    expect(size?.state).toBe('included');
  });

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

  it('describes wireframe screens and both declared and inline navigation without JSON', () => {
    const context = buildReportContext({ ...baseParams, artifacts: [wireframeArtifact({})] });
    expect(context.text).toContain('screens: Inbox; Session Detail');
    expect(context.text).toContain('Inbox to Session Detail');
    expect(context.text).toContain('Session Detail to Inbox');
    expect(context.text).not.toContain('"version"');
    expect(context.inventory.find((row) => row.id === 'artifacts')?.detail).toEqual([
      'wireframe artifact-1: 2 screen titles, 2 of 2 transitions',
    ]);
  });

  it('bounds wireframe transitions by complete routes and reports what was omitted', () => {
    const screens = Array.from({ length: 6 }, (_, from) => ({
      id: `screen-${from}`,
      title: `Screen ${from}`,
      viewport: 'desktop',
      root: {
        id: `root-${from}`,
        kind: 'stack',
        direction: 'column',
        children: Array.from({ length: 6 }, (_, to) => to)
          .filter((to) => to !== from)
          .map((to) => ({
            id: `route-${from}-${to}`,
            kind: 'button',
            label: `Open ${to}`,
            action: { type: 'navigate', toScreenId: `screen-${to}` },
          })),
      },
    }));
    const sourceText = JSON.stringify({
      version: 1,
      initialScreenId: 'screen-0',
      theme: { name: 'generic', font: 'sans', radius: 'md' },
      screens,
      transitions: [],
    });
    const context = buildReportContext({
      ...baseParams,
      artifacts: [wireframeArtifact({ sourceText })],
    });
    expect(context.text).toContain('Screen 3 to Screen 5');
    expect(context.text).not.toContain('Screen 4 to Screen 0');
    expect(context.inventory.find((row) => row.id === 'artifacts')).toMatchObject({
      state: 'partial',
      detail: ['wireframe artifact-1: 6 screen titles, 20 of 30 transitions'],
    });
    expect(context.truncations).toContain('artifact artifact-1: excerpt truncated');
  });

  it.each(['{"screens":', '{"version":1,"screens":[]}'])(
    'falls back for a malformed wireframe (%s)',
    (sourceText) => {
      const context = buildReportContext({
        ...baseParams,
        artifacts: [wireframeArtifact({ sourceText })],
      });
      expect(context.text).toContain(sourceText);
      expect(context.inventory.find((row) => row.id === 'artifacts')?.detail).toEqual([
        'wireframe artifact-1: invalid wireframe, source excerpt up to 400 characters',
      ]);
    },
  );

  it('clips and redacts the malformed wireframe fallback', () => {
    const sourceText = 'password: hunter2000xyz\n' + 'x'.repeat(500);
    const context = buildReportContext({
      ...baseParams,
      artifacts: [wireframeArtifact({ sourceText })],
    });
    expect(context.text).toContain('password: [redacted]');
    expect(context.text).not.toContain('hunter2000xyz');
    expect(context.text).not.toContain('x'.repeat(401));
    expect(context.truncations).toContain('artifact artifact-1: excerpt truncated');
    expect(context.inventory.find((row) => row.id === 'artifacts')?.state).toBe('partial');
  });

  it('includes report headings beyond the old prefix instead of body text', () => {
    const context = buildReportContext({
      ...baseParams,
      artifacts: [
        reportArtifact({
          sourceText: `# Outcome\n${'body '.repeat(100)}\n## Risks\npassword: hidden-in-body`,
        }),
      ],
    });
    expect(context.text).toContain('headings: Outcome; Risks');
    expect(context.text).not.toContain('body body');
    expect(context.text).not.toContain('hidden-in-body');
    expect(context.inventory.find((row) => row.id === 'artifacts')?.detail).toEqual([
      'report artifact-1: 2 of 2 headings',
    ]);
  });

  it('reports omitted headings without cutting a heading in half', () => {
    const sourceText = Array.from({ length: 13 }, (_, index) => `## Heading ${index}`).join('\n');
    const context = buildReportContext({
      ...baseParams,
      artifacts: [reportArtifact({ sourceText })],
    });
    expect(context.text).toContain('Heading 11');
    expect(context.text).not.toContain('Heading 12');
    expect(context.inventory.find((row) => row.id === 'artifacts')).toMatchObject({
      state: 'partial',
      detail: ['report artifact-1: 12 of 13 headings'],
    });
    expect(context.truncations).toContain('artifact artifact-1: excerpt truncated');
  });

  it('retains source excerpts for plans and reports without headings', () => {
    const context = buildReportContext({
      ...baseParams,
      artifacts: [
        { ...reportArtifact({ sourceText: 'plan text' }), kind: 'plan', metadata: {} },
        reportArtifact({ id: 'artifact-2' as ArtifactId, sourceText: 'plain report' }),
      ],
    });
    expect(context.text).toContain('plan text');
    expect(context.text).toContain('plain report');
    expect(context.inventory.find((row) => row.id === 'artifacts')?.detail).toEqual([
      'plan artifact-1: source excerpt up to 400 characters',
      'report artifact-2: no headings, source excerpt up to 400 characters',
    ]);
  });

  it('redacts credentials in structured titles and headings', () => {
    const wireframe = wireframeArtifact({});
    const context = buildReportContext({
      ...baseParams,
      artifacts: [
        {
          ...wireframe,
          sourceText: wireframe.sourceText.replace('Session Detail', 'password: hunter2000xyz'),
        },
        reportArtifact({
          id: 'artifact-2' as ArtifactId,
          sourceText: '## api_key=harborline-test-value',
        }),
      ],
    });
    expect(context.text).not.toContain('hunter2000xyz');
    expect(context.text).not.toContain('harborline-test-value');
    expect(context.text).toContain('[redacted]');
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

describe('buildReportContext session goal', () => {
  const LONG_GOAL = [
    'Northwind settles ledger-core postings twice a day and the second pass rounds the residual away.',
    'Walk the notify-relay receipts against the ledger and show where the cent goes missing.',
  ].join('\n\n');

  it('leaves out the goal block when the slot says no more than the title', () => {
    expect(buildReportContext({ ...baseParams }).text).not.toContain('## goal');
  });

  it('carries the goal the user wrote in its own block after the header', () => {
    const context = buildReportContext({ ...baseParams, goal: goalOf({ value: LONG_GOAL }) });
    expect(context.text).toContain(`## goal\n\n${LONG_GOAL}`);
    expect(context.text).toContain(`session ${SESSION_ID}: ${session.goal}`);
    expect(context.text.indexOf('## goal')).toBeLessThan(context.text.indexOf('## agents'));
  });

  it('redacts a secret carried in the goal the user wrote', () => {
    const context = buildReportContext({
      ...baseParams,
      goal: goalOf({ value: `${LONG_GOAL}\n\nuse api_key=harborline-test-value` }),
    });
    expect(context.text).not.toContain('harborline-test-value');
    expect(context.text).toContain(REDACTED);
  });

  it('reports the goal the user wrote in the inventory', () => {
    const context = buildReportContext({ ...baseParams, goal: goalOf({ value: LONG_GOAL }) });
    const row = context.inventory.find((entry) => entry.id === 'goal');
    expect(row?.state).toBe('included');
    expect(row?.detail).toEqual([`the goal you wrote, ${LONG_GOAL.length} characters`]);
  });

  it('keeps the goal inventory row bare when only the title is sent', () => {
    const row = buildReportContext({ ...baseParams }).inventory.find(
      (entry) => entry.id === 'goal',
    );
    expect(row?.state).toBe('included');
    expect(row?.detail).toEqual([]);
  });

  it('notes a clipped goal in the truncation section and the inventory', () => {
    const context = buildReportContext({
      ...baseParams,
      goal: goalOf({ value: 'Harborline '.repeat(SESSION_GOAL_LIMITS.chars) }),
    });
    expect(context.truncations).toContain(SESSION_GOAL_CLIP_NOTE);
    expect(context.text).toContain(SESSION_GOAL_CLIP_NOTE);
    expect(context.inventory.find((entry) => entry.id === 'goal')?.state).toBe('partial');
  });
});
