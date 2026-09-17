import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AgentId,
  ContextSlot,
  IsoDateTime,
  MountId,
  ProjectId,
  Session,
  SessionId,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';
import {
  NO_MOUNT_NO_SCOUT_REASON,
  SESSION_SUMMARY_NO_SCOUT_REASON,
} from '../../../features/artifacts/pickArtifactScouts';
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
const IMPLEMENTER_ID = 'agent-implementer' as AgentId;
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
const startReportScoutsSpy = vi.fn(async (_args: Record<string, unknown>) => false);
const sendTurnSpy = vi.fn(async (_args: Record<string, unknown>) => undefined);

const packOf = (): string => {
  const spawned = spawnAgentSpy.mock.calls[0]?.[1]['initialPrompt'];
  if (typeof spawned === 'string') {
    return spawned;
  }
  return String(sendTurnSpy.mock.calls.at(-1)?.[0]['content'] ?? '');
};

const baseState = {
  sessions: [session],
  sessionPhaseRuns: {
    [SESSION_ID]: [
      {
        id: IMPLEMENTER_ID,
        sessionId: SESSION_ID,
        ordinal: 0,
        name: 'implementer',
        status: 'completed',
      },
    ],
  },
  transcripts: {
    [IMPLEMENTER_ID]: [{ kind: 'assistant_text', runId: 'r1', delta: 'work is done', at: NOW }],
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
  sessionSlots: {} as Record<string, ReadonlyArray<ContextSlot>>,
  spawnAgent: spawnAgentSpy,
  startReportScouts: startReportScoutsSpy,
  sendTurn: sendTurnSpy,
};

const getWith = (overrides: Record<string, unknown> = {}): GetFn => {
  const state: Record<string, unknown> = { ...baseState, ...overrides };
  state['ensureSessionSlots'] = async (
    sessionId: SessionId,
  ): Promise<ReadonlyArray<ContextSlot>> => {
    const slots = state['sessionSlots'] as Record<string, ReadonlyArray<ContextSlot>>;
    return slots[sessionId] ?? [];
  };
  return (() => state) as unknown as GetFn;
};

const LONG_GOAL = [
  'Northwind settles ledger-core postings twice a day and the second pass rounds the residual away.',
  'Walk the notify-relay receipts against the ledger and show where the cent goes missing.',
].join('\n\n');

const withGoalSlot = (): GetFn =>
  getWith({
    sessionSlots: { [SESSION_ID]: [{ key: 'goal', value: LONG_GOAL, enabled: true }] },
  });

describe('spawnReportAgent', () => {
  it('spawns without taking focus when asked', async () => {
    await spawnReportAgent(getWith())({
      sessionId: SESSION_ID,
      attachments: [],
      reportType: 'session-summary',
      focus: 'none',
    });
    const args = spawnAgentSpy.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(args['focus']).toBe('none');
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('spawns a standalone report agent with no step, run or parent linkage', async () => {
    await spawnReportAgent(getWith())({
      sessionId: SESSION_ID,
      attachments: [],
      reportType: 'session-summary',
    });
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
      attachments: [],
      reportType: 'change-summary',
      workflowRunId: RUN_ID,
    });
    const prompt = packOf();
    expect(prompt).toContain('evidence pack');
    expect(prompt).toContain(`workflow run ${RUN_ID}`);
    expect(prompt).toContain('abcdef1 feat: reports');
    expect(prompt).toContain('+4 -1');
  });

  it('fans a diff context scout out over the mount the diff touched', async () => {
    startReportScoutsSpy.mockResolvedValueOnce(true);
    await spawnReportAgent(getWith())({
      sessionId: SESSION_ID,
      attachments: [],
      reportType: 'change-summary',
    });
    const args = spawnAgentSpy.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(args['initialPrompt']).toBeUndefined();
    expect(startReportScoutsSpy).toHaveBeenCalledTimes(1);
    const started = startReportScoutsSpy.mock.calls[0]![0];
    expect(started['changedMountIds']).toEqual(['mount-1']);
    expect(started['changedPaths']).toEqual(['apps/desktop/src/a.ts']);
    expect(started['mounts']).toEqual([
      { mountId: 'mount-1', mountName: 'goodboy', root: '.', worktreePath: '/tmp/worktree' },
    ]);
    expect(sendTurnSpy).not.toHaveBeenCalled();
  });

  it('opens the run in the gathering phase with the mount it will read', async () => {
    startReportScoutsSpy.mockResolvedValueOnce(true);
    await spawnReportAgent(getWith())({
      sessionId: SESSION_ID,
      attachments: [],
      reportType: 'change-summary',
    });
    const recorded = recordProvenanceSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(recorded['phase']).toBe('gathering');
    expect(recorded['mountIds']).toEqual(['mount-1']);
    expect(recorded['deadlineAt']).toBeGreaterThan(Date.now());
  });

  it('spawns no scout for a session summary and says why on the row', async () => {
    await spawnReportAgent(getWith())({
      sessionId: SESSION_ID,
      attachments: [],
      reportType: 'session-summary',
    });
    expect(startReportScoutsSpy).not.toHaveBeenCalled();
    const prompt = packOf();
    expect(prompt).toContain('evidence pack');
    const recorded = recordProvenanceSpy.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(recorded['omissions']).toContain(SESSION_SUMMARY_NO_SCOUT_REASON);
    expect(recorded['phase']).toBe('producing');
  });

  it('spawns no scout when no repository is mounted and says so', async () => {
    await spawnReportAgent(getWith({ sessionProjectMounts: { [SESSION_ID]: [] } }))({
      sessionId: SESSION_ID,
      attachments: [],
      reportType: 'change-summary',
    });
    expect(startReportScoutsSpy).not.toHaveBeenCalled();
    const recorded = recordProvenanceSpy.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(recorded['omissions']).toContain(NO_MOUNT_NO_SCOUT_REASON);
    expect(recorded['mountIds']).toEqual([]);
  });

  it('carries the goal the user wrote into the kickoff pack, not the clamped title', async () => {
    await spawnReportAgent(withGoalSlot())({
      sessionId: SESSION_ID,
      attachments: [],
      reportType: 'session-summary',
    });
    const prompt = packOf();
    expect(prompt).toContain(`## goal\n\n${LONG_GOAL}`);
    expect(prompt).toContain(`session ${SESSION_ID}: ${session.goal}`);
  });

  it('sends the title alone when no goal slot says more', async () => {
    await spawnReportAgent(getWith())({
      sessionId: SESSION_ID,
      attachments: [],
      reportType: 'session-summary',
    });
    const prompt = packOf();
    expect(prompt).not.toContain('## goal');
  });

  it('still spawns when the diff collection fails', async () => {
    changedFilesSpy.mockRejectedValueOnce(new Error('not a worktree'));
    await spawnReportAgent(getWith())({
      sessionId: SESSION_ID,
      attachments: [],
      reportType: 'session-summary',
    });
    expect(packOf()).toContain('no mount diff was available');
  });

  it('adds a redacted brief while retaining session output and collected diff evidence', async () => {
    await spawnReportAgent(getWith())({
      sessionId: SESSION_ID,
      attachments: [],
      reportType: 'change-summary',
      brief: 'explain the Harborline rollout with api_key=harborline-test-value',
    });
    const prompt = packOf();
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
      attachments: [],
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
      attachments: [],
      reportType: 'change-summary',
      workflowRunId: RUN_ID,
      brief: 'explain the Harborline rollout with api_key=harborline-test-value',
    });
    const recorded = recordProvenanceSpy.mock.calls.at(-1)?.[0] as Record<string, unknown>;
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
    await spawnReportAgent(getWith())({
      sessionId: SESSION_ID,
      attachments: [],
      reportType: 'session-summary',
    });
    const recorded = recordProvenanceSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(recorded['evidence']).toEqual([
      { kind: 'session', id: SESSION_ID, label: 'ship the report role' },
      { kind: 'agent', id: IMPLEMENTER_ID, label: 'implementer' },
    ]);
    expect(recorded['sourceWorkflowRunId']).toBeNull();
  });

  it('records no brief when none was given and still spawns when provenance cannot be written', async () => {
    recordProvenanceSpy.mockRejectedValueOnce(new Error('database is locked'));
    const agentId = await spawnReportAgent(getWith())({
      sessionId: SESSION_ID,
      attachments: [],
      reportType: 'session-summary',
    });
    expect(agentId).toBe(AGENT_ID);
    expect(recordProvenanceSpy.mock.calls[0]?.[0]['brief']).toBeNull();
  });

  it('collects fresh evidence and provenance when the supplied pack is whitespace', async () => {
    await spawnReportAgent(getWith())({
      sessionId: SESSION_ID,
      attachments: [],
      reportType: 'session-summary',
      evidence: ' \n ',
    });
    expect(changedFilesSpy).toHaveBeenCalled();
    expect(spawnAgentSpy.mock.calls[0]?.[1]['initialPrompt']).toContain('evidence pack');
    expect(recordProvenanceSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: AGENT_ID,
        executingWorkflowRunId: null,
      }),
    );
  });

  it('throws when the session is unknown', async () => {
    await expect(
      spawnReportAgent(getWith({ sessions: [] }))({
        sessionId: SESSION_ID,
        attachments: [],
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
