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
import {
  ARTIFACT_QUESTION_LIMIT,
  artifactQuestionContract,
} from '../artifacts/artifactQuestionContract';
import { REDACTED } from '../../shared/utils/redactSecrets';
import { ARTIFACT_SECTION_CUT_NOTE, ARTIFACT_SECTION_REMOVED_NOTE } from './allocateReportContext';
import {
  buildReportContext,
  REPORT_CONTEXT_LIMITS,
  REPORT_SESSION_TITLE_CLIP_NOTE,
} from './buildReportContext';

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

const assistantTurnAt = ({
  runId,
  delta,
  at,
}: {
  runId: string;
  delta: string;
  at: IsoDateTime;
}): TurnEvent => ({
  kind: 'assistant_text',
  runId: runId as TurnEvent['runId'],
  delta,
  at,
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
  attachments: [],
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

describe('buildReportContext question contract', () => {
  it('tells the agent to ask at most two marked questions before the report', () => {
    const text = buildReportContext({ ...baseParams }).text;
    expect(text).toContain('## questions');
    expect(text).toContain(
      '<<ctx-question suggestions="first option|second option" recommended="first option" select="one" blocking="true">>the question<</ctx-question>>',
    );
    expect(text).toContain(`at most ${ARTIFACT_QUESTION_LIMIT} questions`);
    expect(text).toContain(
      'when no question is blocking, put the questions before the artifact block, in the same turn',
    );
  });

  it('stops the turn at the questions when one of them blocks', () => {
    const text = buildReportContext({ ...baseParams }).text;
    expect(text).toContain(
      'when any question is blocking, send the questions and nothing else: no artifact block in that turn',
    );
    expect(text).toContain('the answers come back to you as a new turn');
  });

  it('teaches when a question earns the blocking mark', () => {
    const text = buildReportContext({ ...baseParams }).text;
    expect(text).toContain('mark a question blocking="true" only when both of these hold');
    expect(text).toContain('the answer changes what the report says rather than how it says it');
    expect(text).toContain('a preference with a defensible default is never blocking');
  });

  it('names the report home for the assumption it made', () => {
    expect(buildReportContext({ ...baseParams }).text).toContain(
      'a line in the body of the report',
    );
  });

  it('keeps the contract after the truncation notes, outside the capped evidence', () => {
    const text = buildReportContext({
      ...baseParams,
      brief: 'Harborline '.repeat(REPORT_CONTEXT_LIMITS.total),
    }).text;
    expect(text.indexOf('## questions')).toBeGreaterThan(text.indexOf('## truncation'));
  });
});

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
    expect(agents?.summary).toContain(
      'agents, most recent final message given priority within a shared budget',
    );
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
    const long = 'x'.repeat(REPORT_CONTEXT_LIMITS.total + 1_000);
    const context = buildReportContext({
      ...baseParams,
      transcripts: { [AGENT_ID]: [assistantTurn({ runId: 'r1', delta: long })] },
    });
    expect(context.truncations.some((note) => note.includes('truncated'))).toBe(true);
    expect(context.text).toContain('## truncation');
    expect(context.text.length).toBeLessThanOrEqual(REPORT_CONTEXT_LIMITS.total);
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

describe('buildReportContext agent budget allocation', () => {
  it('keeps a lone 7,600 character final message whole', () => {
    const long = 'x'.repeat(7_600);
    const context = buildReportContext({
      ...baseParams,
      transcripts: { [AGENT_ID]: [assistantTurn({ runId: 'r1', delta: long })] },
    });
    expect(context.text).toContain(long);
    expect(context.truncations.some((note) => note.includes('agent-1'))).toBe(false);
  });

  it('keeps a 20,000 character newest message whole alongside older agents', () => {
    const NEWER_AGENT_ID = 'agent-3' as AgentId;
    const long = 'y'.repeat(20_000);
    const context = buildReportContext({
      ...baseParams,
      agents: [
        agent({ id: AGENT_ID, ordinal: 0, name: 'earlier' }),
        agent({ id: NEWER_AGENT_ID, ordinal: 1, name: 'closer' }),
      ],
      transcripts: {
        [AGENT_ID]: [assistantTurnAt({ runId: 'r1', delta: 'older final message', at: NOW })],
        [NEWER_AGENT_ID]: [
          assistantTurnAt({
            runId: 'r2',
            delta: long,
            at: '2026-09-15T11:00:00.000Z' as IsoDateTime,
          }),
        ],
      },
    });
    expect(context.text).toContain(long);
    expect(context.text).toContain('older final message');
    expect(context.text.length).toBeLessThanOrEqual(REPORT_CONTEXT_LIMITS.total);
  });

  it('lets a recent rerun of a lower ordinal win over a stale higher ordinal', () => {
    const STALE_ID = 'agent-stale' as AgentId;
    const FRESH_ID = 'agent-fresh' as AgentId;
    const freshMessage = 'z'.repeat(20_000);
    const context = buildReportContext({
      ...baseParams,
      agents: [
        agent({ id: STALE_ID, ordinal: 5, name: 'stale' }),
        agent({ id: FRESH_ID, ordinal: 2, name: 'fresh' }),
      ],
      transcripts: {
        [STALE_ID]: [
          assistantTurnAt({
            runId: 'r1',
            delta: 'stale summary',
            at: '2026-09-14T10:00:00.000Z' as IsoDateTime,
          }),
        ],
        [FRESH_ID]: [
          assistantTurnAt({
            runId: 'r2',
            delta: freshMessage,
            at: '2026-09-15T12:00:00.000Z' as IsoDateTime,
          }),
        ],
      },
    });
    expect(context.text).toContain(freshMessage);
    expect(context.truncations.some((note) => note.includes('agent-fresh'))).toBe(false);
  });

  it('cuts a message larger than the whole allowance on a boundary and discloses it', () => {
    const long = 'Harborline shipped the ledger fix. '.repeat(2_000);
    const context = buildReportContext({
      ...baseParams,
      transcripts: { [AGENT_ID]: [assistantTurn({ runId: 'r1', delta: long })] },
    });
    expect(context.text).not.toContain(long);
    expect(context.text).toContain('...');
    expect(context.truncations).toContain('agent agent-1: final message truncated');
    expect(context.text.length).toBeLessThanOrEqual(REPORT_CONTEXT_LIMITS.total);
  });

  it('never lets the complete returned text exceed 48,000 characters, however much evidence is offered', () => {
    const manyAgents = Array.from({ length: REPORT_CONTEXT_LIMITS.agents }, (_, index) => ({
      id: `agent-many-${index}` as AgentId,
      ordinal: index,
    }));
    const context = buildReportContext({
      ...baseParams,
      agents: manyAgents.map(({ id, ordinal }) => agent({ id, ordinal, name: `agent ${ordinal}` })),
      transcripts: Object.fromEntries(
        manyAgents.map(({ id }, index) => [
          id,
          [
            assistantTurnAt({
              runId: `r-${index}`,
              delta: 'Harborline settlement notes. '.repeat(500),
              at: `2026-09-15T${String(10 + index).padStart(2, '0')}:00:00.000Z` as IsoDateTime,
            }),
          ],
        ]),
      ),
      diff: {
        mountName: 'goodboy',
        baseBranch: 'main',
        headSha: 'abc1234',
        commits: Array.from({ length: 20 }, (_, index) => ({
          sha: `commit-${index}`,
          subject: `chore: change number ${index}`,
        })),
        additions: 400,
        deletions: 120,
        paths: Array.from({ length: 40 }, (_, index) => `apps/desktop/src/file-${index}.ts`),
      },
    });
    expect(context.text.length).toBeLessThanOrEqual(REPORT_CONTEXT_LIMITS.total);
  });

  it('builds sourceIds and the agents inventory row from what was actually retained', () => {
    const manyAgents = Array.from({ length: 15 }, (_, index) => ({
      id: `agent-drop-${index}` as AgentId,
      ordinal: index,
    }));
    const context = buildReportContext({
      ...baseParams,
      agents: manyAgents.map(({ id, ordinal }) => agent({ id, ordinal, name: `agent ${ordinal}` })),
      transcripts: Object.fromEntries(
        manyAgents.map(({ id }, index) => [
          id,
          [assistantTurn({ runId: `r-${index}`, delta: `output from ${id}` })],
        ]),
      ),
    });
    const droppedIds = manyAgents.slice(0, 3).map(({ id }) => id);
    const keptIds = manyAgents.slice(3).map(({ id }) => id);
    droppedIds.forEach((id) => expect(context.sourceIds).not.toContain(id));
    keptIds.forEach((id) => expect(context.sourceIds).toContain(id));
    const row = context.inventory.find((entry) => entry.id === 'agents');
    expect(row?.state).toBe('partial');
    expect(row?.summary).toContain(`${keptIds.length} of ${manyAgents.length} agents`);
  });

  it('gives up the oldest agent first when formatting overhead overflows the cap', () => {
    const NEWEST_ID = 'agent-newest' as AgentId;
    const olderIds = Array.from({ length: 11 }, (_, index) => `agent-older-${index}` as AgentId);
    const newestMessage = 'Harborline closed the ledger gap. '.repeat(150);
    const olderMessage = 'Older agent notes on the ledger pass. '.repeat(540);
    const context = buildReportContext({
      ...baseParams,
      agents: [
        ...olderIds.map((id, index) => agent({ id, ordinal: index, name: `older ${index}` })),
        agent({ id: NEWEST_ID, ordinal: olderIds.length, name: 'newest' }),
      ],
      transcripts: {
        ...Object.fromEntries(
          olderIds.map((id, index) => [
            id,
            [
              assistantTurnAt({
                runId: `r-${index}`,
                delta: olderMessage,
                at: `2026-09-15T${String(10 + index).padStart(2, '0')}:00:00.000Z` as IsoDateTime,
              }),
            ],
          ]),
        ),
        [NEWEST_ID]: [
          assistantTurnAt({
            runId: 'r-newest',
            delta: newestMessage,
            at: '2026-09-15T23:00:00.000Z' as IsoDateTime,
          }),
        ],
      },
    });
    const bodyOf = ({ id, name }: { readonly id: AgentId; readonly name: string }) =>
      context.text.split(`### ${name} (agent ${id}, completed)\n\n`)[1]?.split('\n\n')[0] ?? '';
    expect(context.text.length).toBeLessThanOrEqual(REPORT_CONTEXT_LIMITS.total);
    expect(bodyOf({ id: NEWEST_ID, name: 'newest' })).toBe(newestMessage.trim());
    expect(context.truncations).not.toContain(`agent ${NEWEST_ID}: final message truncated`);
    expect(context.text).not.toContain('### older 0 (agent agent-older-0, completed)');
    expect(context.truncations).toContain('agent agent-older-0: final message dropped to fit');
    expect(context.inventory.find((entry) => entry.id === 'agents')?.detail).toContain(
      '1 did not fit and were dropped',
    );
  });

  it('cuts the newest message on a boundary and says so when nothing else can give room', () => {
    const NEWEST_ID = 'agent-newest' as AgentId;
    const olderIds = Array.from({ length: 3 }, (_, index) => `agent-older-${index}` as AgentId);
    const newestMessage = 'Harborline shipped the ledger fix. '.repeat(2_000);
    const context = buildReportContext({
      ...baseParams,
      agents: [
        ...olderIds.map((id, index) => agent({ id, ordinal: index, name: `older ${index}` })),
        agent({ id: NEWEST_ID, ordinal: olderIds.length, name: 'newest' }),
      ],
      transcripts: {
        ...Object.fromEntries(
          olderIds.map((id, index) => [
            id,
            [
              assistantTurnAt({
                runId: `r-${index}`,
                delta: 'tiny note',
                at: `2026-09-15T${String(10 + index).padStart(2, '0')}:00:00.000Z` as IsoDateTime,
              }),
            ],
          ]),
        ),
        [NEWEST_ID]: [
          assistantTurnAt({
            runId: 'r-newest',
            delta: newestMessage,
            at: '2026-09-15T23:00:00.000Z' as IsoDateTime,
          }),
        ],
      },
    });
    const shown =
      context.text.split(`### newest (agent ${NEWEST_ID}, completed)\n\n`)[1]?.split('\n\n')[0] ??
      '';
    expect(newestMessage.length).toBeGreaterThan(REPORT_CONTEXT_LIMITS.total);
    expect(context.text.length).toBeLessThanOrEqual(REPORT_CONTEXT_LIMITS.total);
    expect(context.truncations).toContain(`agent ${NEWEST_ID}: final message truncated`);
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.endsWith('...')).toBe(true);
    expect(shown.slice(0, -3)).toMatch(/ledger fix\.$/);
    expect(newestMessage.startsWith(shown.slice(0, -3))).toBe(true);
  });

  it('still redacts a credential in a final message long enough to be clipped', () => {
    const long = `api_key=harborline-secret-value ${'padding text '.repeat(3_000)}`;
    const context = buildReportContext({
      ...baseParams,
      transcripts: { [AGENT_ID]: [assistantTurn({ runId: 'r1', delta: long })] },
    });
    expect(context.text).not.toContain('harborline-secret-value');
    expect(context.text).toContain('[redacted]');
  });
});

describe('buildReportContext budget honesty', () => {
  it('drops the ids and reports the loss when the evidence budget removes the artifacts block', () => {
    const context = buildReportContext({
      ...baseParams,
      artifacts: [reportArtifact({})],
      scouts: {
        names: ['scout-a'],
        section: `## scouts\n\n${'Harborline scout finding on the ledger. '.repeat(400)}`,
        note: null,
      },
    });
    expect(context.text).not.toContain('artifact-1');
    expect(context.sourceIds).not.toContain('artifact-1');
    expect(context.truncations).toContain(
      'evidence pack: artifacts section removed to fit the evidence budget',
    );
    const row = context.inventory.find((entry) => entry.id === 'artifacts');
    expect(row?.state).toBe('missing');
    expect(row?.detail).toContain(ARTIFACT_SECTION_REMOVED_NOTE);
  });

  it('keeps only the artifact ids that survived an artifacts block the evidence budget cut', () => {
    const planArtifact = (id: string) => ({
      ...reportArtifact({ id: id as ArtifactId, sourceText: 'ledger walkthrough. '.repeat(20) }),
      kind: 'plan' as const,
      metadata: {},
    });
    const context = buildReportContext({
      ...baseParams,
      artifacts: [
        planArtifact('artifact-1'),
        planArtifact('artifact-2'),
        planArtifact('artifact-3'),
      ],
      scouts: {
        names: ['scout-a'],
        section: `## scouts\n\n${'Harborline scout finding. '.repeat(280)}`,
        note: null,
      },
    });
    expect(context.truncations).toContain(
      'evidence pack: artifacts section shortened to fit the evidence budget',
    );
    expect(context.sourceIds).toContain('artifact-1');
    expect(context.sourceIds).not.toContain('artifact-3');
    const row = context.inventory.find((entry) => entry.id === 'artifacts');
    expect(row?.state).toBe('partial');
    expect(row?.detail).toContain(ARTIFACT_SECTION_CUT_NOTE);
  });

  it('holds the cap when the session title and the attachment list are far past the framing reservation', () => {
    const attachments = Array.from({ length: 300 }, (_, index) => ({
      id: `attachment-${index}`,
      fileName: `file-${index}.png`,
      mimeType: 'image/png',
      relPath: `${'nested-folder/'.repeat(10)}file-${index}.png`,
    }));
    const hugeSession: Session = { ...session, goal: 'Harborline '.repeat(6_000) };
    const context = buildReportContext({
      ...baseParams,
      session: hugeSession,
      attachments,
      brief: 'explain the Harborline rollout risks',
    });
    expect(hugeSession.goal.length).toBeGreaterThan(60_000);
    expect(context.text.length).toBeLessThanOrEqual(REPORT_CONTEXT_LIMITS.total);
    expect(context.text).toContain('# user request\n\nexplain the Harborline rollout risks');
    expect(context.text).toContain('## questions');
    expect(context.text).toContain(artifactQuestionContract({ kind: 'report' }));
    expect(context.truncations).toContain(REPORT_SESSION_TITLE_CLIP_NOTE);
    const row = context.inventory.find((entry) => entry.id === 'attachments');
    expect(row?.state).toBe('partial');
    expect(context.inventory.find((entry) => entry.id === 'size')?.summary).toContain(
      context.text.length.toLocaleString('en-US'),
    );
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

  it('counts the redacted goal in the inventory, not the raw one', () => {
    const goal = goalOf({ value: `${LONG_GOAL}\n\nuse api_key=harborline-test-value` });
    expect(goal.packText.length).toBeLessThan(goal.editorText.length);
    const row = buildReportContext({ ...baseParams, goal }).inventory.find(
      (entry) => entry.id === 'goal',
    );
    expect(row?.detail).toEqual([`the goal you wrote, ${goal.packText.length} characters`]);
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
