import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AgentId,
  IsoDateTime,
  MountId,
  ProjectId,
  Session,
  SessionId,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';
import { resolveReportRouting, spawnReportAgent } from './spawnReportAgent';
import type { GetFn } from './types';

const changedFilesSpy = vi.fn(async (_args: unknown) => ({
  paths: ['apps/desktop/src/a.ts'],
  additions: 4,
  deletions: 1,
  numstat: '',
}));
const commitsSpy = vi.fn(async (_path: string) => [
  {
    sha: 'abcdef1234',
    shortSha: 'abcdef1',
    subject: 'feat: reports',
    author: 'dev',
    timestamp: 0,
    pushed: false,
    parentSha: null,
  },
]);

vi.mock('../../../features/worktree/worktree', () => ({
  worktreeChangedFiles: (args: unknown) => changedFilesSpy(args as never),
  listBranchCommits: (path: string) => commitsSpy(path as never),
}));

const recordProvenanceSpy = vi.fn(async (_args: Record<string, unknown>) => undefined);

vi.mock('../../../features/artifacts/artifactProvenance', async () => {
  const actual = await vi.importActual<
    typeof import('../../../features/artifacts/artifactProvenance')
  >('../../../features/artifacts/artifactProvenance');
  return {
    artifactEvidenceInventory: actual.artifactEvidenceInventory,
    recordArtifactProvenance: (args: Record<string, unknown>) => recordProvenanceSpy(args),
  };
});

const SESSION_ID = 'session-1' as SessionId;
const AGENT_ID = 'agent-1' as AgentId;
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

const mount = {
  mountId: 'mount-1' as MountId,
  sessionId: SESSION_ID,
  projectId: 'project-1' as ProjectId,
  mountName: 'goodboy',
  worktreePath: '/tmp/worktree',
  lastWorktreePath: null,
  repoRoot: '/tmp/repo',
  branch: 'ak/feat-x',
  baseBranch: 'main',
  parallelIndex: 0,
  repoSlug: null,
  isAttached: true,
  diskState: 'present',
  revision: 1,
  createdAt: NOW,
  updatedAt: NOW,
};

const spawnAgentSpy = vi.fn(
  async (_sessionId: SessionId, _args: Record<string, unknown>) => AGENT_ID,
);

const baseState = {
  sessions: [session],
  sessionPhaseRuns: {
    [SESSION_ID]: [
      {
        id: AGENT_ID,
        sessionId: SESSION_ID,
        ordinal: 0,
        name: 'implementer',
        status: 'completed',
      },
    ],
  },
  transcripts: {
    [AGENT_ID]: [{ kind: 'assistant_text', runId: 'r1', delta: 'work is done', at: NOW }],
  },
  sessionArtifacts: {},
  sessionEvents: {},
  scriptRuns: {},
  workspaceOverrides: {},
  providers: [
    { id: 'anthropic', connection: 'connected' },
    { id: 'codex', connection: 'connected' },
  ],
  providerCooldowns: {},
  budgetAlerts: [],
  sessionMounts: {},
  sessionProjectMounts: { [SESSION_ID]: [mount] },
  sessionActiveMount: { [SESSION_ID]: mount.mountId },
  sessionActiveProject: {},
  mountBranchObservations: {},
  spawnAgent: spawnAgentSpy,
};

const getWith = (overrides: Record<string, unknown> = {}): GetFn =>
  (() => ({ ...baseState, ...overrides })) as unknown as GetFn;

describe('spawnReportAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('spawns a standalone report agent with no step, run or parent linkage', async () => {
    await spawnReportAgent(getWith())({ sessionId: SESSION_ID, reportType: 'session-summary' });
    const args = spawnAgentSpy.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(spawnAgentSpy.mock.calls[0]?.[0]).toBe(SESSION_ID);
    expect(args['kindOverride']).toBe('report');
    expect(args['stepId']).toBeUndefined();
    expect(args['workflowRunId']).toBeUndefined();
    expect(args['parentAgentId']).toBeUndefined();
  });

  it('carries the evidence pack as the kickoff prompt', async () => {
    await spawnReportAgent(getWith())({
      sessionId: SESSION_ID,
      reportType: 'change-summary',
      workflowRunId: RUN_ID,
    });
    const args = spawnAgentSpy.mock.calls[0]?.[1] as Record<string, unknown>;
    const prompt = String(args['initialPrompt']);
    expect(prompt).toContain('evidence pack');
    expect(prompt).toContain(`workflow run ${RUN_ID}`);
    expect(prompt).toContain('abcdef1 feat: reports');
    expect(prompt).toContain('+4 -1');
  });

  it('still spawns when the diff collection fails', async () => {
    changedFilesSpy.mockRejectedValueOnce(new Error('not a worktree'));
    await spawnReportAgent(getWith())({ sessionId: SESSION_ID, reportType: 'session-summary' });
    const args = spawnAgentSpy.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(String(args['initialPrompt'])).toContain('no mount diff was available');
  });

  it('adds a redacted brief while retaining session output and collected diff evidence', async () => {
    await spawnReportAgent(getWith())({
      sessionId: SESSION_ID,
      reportType: 'change-summary',
      brief: 'explain the Harborline rollout with api_key=harborline-test-value',
    });
    const prompt = String(spawnAgentSpy.mock.calls[0]?.[1]['initialPrompt']);
    expect(prompt).toContain(
      '# user request\n\nexplain the Harborline rollout with api_key=[redacted]',
    );
    expect(prompt).not.toContain('harborline-test-value');
    expect(prompt).toContain('work is done');
    expect(prompt).toContain('abcdef1 feat: reports');
    expect(prompt).toContain('+4 -1');
  });

  it('reuses a supplied evidence pack for regeneration without collecting a new diff', async () => {
    await spawnReportAgent(getWith())({
      sessionId: SESSION_ID,
      reportType: 'change-summary',
      evidence: 'the original kickoff',
    });
    expect(spawnAgentSpy.mock.calls[0]?.[1]['initialPrompt']).toBe('the original kickoff');
    expect(changedFilesSpy).not.toHaveBeenCalled();
    expect(commitsSpy).not.toHaveBeenCalled();
  });

  it('records what the report was built from, keeping the source run out of the executing run', async () => {
    await spawnReportAgent(getWith())({
      sessionId: SESSION_ID,
      reportType: 'change-summary',
      workflowRunId: RUN_ID,
      brief: 'explain the Harborline rollout with api_key=harborline-test-value',
    });
    const recorded = recordProvenanceSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(recorded['agentId']).toBe(AGENT_ID);
    expect(recorded['kind']).toBe('report');
    expect(recorded['brief']).toBe(
      'explain the Harborline rollout with api_key=harborline-test-value',
    );
    expect(recorded['sourceWorkflowRunId']).toBe(RUN_ID);
    expect(recorded['executingWorkflowRunId']).toBeNull();
    expect(recorded['designProfileSummary']).toBeNull();
    expect(recorded['evidence']).toEqual([
      { kind: 'session', id: SESSION_ID, label: 'ship the report role' },
      { kind: 'workflow-run', id: RUN_ID, label: 'workflow run' },
    ]);
  });

  it('names every session agent the pack carried when no run scopes it', async () => {
    await spawnReportAgent(getWith())({ sessionId: SESSION_ID, reportType: 'session-summary' });
    const recorded = recordProvenanceSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(recorded['evidence']).toEqual([
      { kind: 'session', id: SESSION_ID, label: 'ship the report role' },
      { kind: 'agent', id: AGENT_ID, label: 'implementer' },
    ]);
    expect(recorded['sourceWorkflowRunId']).toBeNull();
  });

  it('records no brief when none was given and still spawns when provenance cannot be written', async () => {
    recordProvenanceSpy.mockRejectedValueOnce(new Error('database is locked'));
    const agentId = await spawnReportAgent(getWith())({
      sessionId: SESSION_ID,
      reportType: 'session-summary',
    });
    expect(agentId).toBe(AGENT_ID);
    expect(recordProvenanceSpy.mock.calls[0]?.[0]['brief']).toBeNull();
  });

  it('throws when the session is unknown', async () => {
    await expect(
      spawnReportAgent(getWith({ sessions: [] }))({
        sessionId: SESSION_ID,
        reportType: 'session-summary',
      }),
    ).rejects.toThrow('session not found');
  });
});

describe('resolveReportRouting', () => {
  it('uses the cheapest connected model by default', () => {
    const routing = resolveReportRouting({
      state: getWith()(),
      sessionId: SESSION_ID,
      picked: null,
    });
    expect(routing.provider).toBe('anthropic');
    expect(routing.effort).toBe('low');
    expect(routing.model).not.toBe('opus-5');
  });

  it('honours an explicit pick over the default', () => {
    const picked = { provider: 'codex', model: 'gpt-5.6-sol', effort: 'high' } as const;
    expect(resolveReportRouting({ state: getWith()(), sessionId: SESSION_ID, picked })).toEqual(
      picked,
    );
  });

  it('honours a role model lock', () => {
    const state = getWith({
      workspaceOverrides: {
        'ws-1': {
          roleModels: { report: { providerId: 'anthropic', model: 'opus-5', effort: 'high' } },
        },
      },
    })();
    const routing = resolveReportRouting({ state, sessionId: SESSION_ID, picked: null });
    expect(routing.model).toBe('opus-5');
    expect(routing.effort).toBe('high');
  });

  it('skips a budget blocked provider', () => {
    const state = getWith({
      budgetAlerts: [{ kind: 'provider-exceeded', provider: 'anthropic' }],
    })();
    const routing = resolveReportRouting({ state, sessionId: SESSION_ID, picked: null });
    expect(routing.provider).toBe('codex');
  });

  it('skips a provider in cooldown', () => {
    const state = getWith({ providerCooldowns: { anthropic: Date.now() + 60_000 } })();
    const routing = resolveReportRouting({ state, sessionId: SESSION_ID, picked: null });
    expect(routing.provider).toBe('codex');
  });
});
