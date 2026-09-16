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
import { resolveWireframeRouting, spawnWireframeAgent } from './spawnWireframeAgent';
import type { GetFn } from './types';

const commitsSpy = vi.fn(async (_path: string) => [
  {
    sha: 'abcdef1234',
    shortSha: 'abcdef1',
    subject: 'feat: wireframes',
    author: 'dev',
    timestamp: 0,
    pushed: false,
    parentSha: null,
  },
]);

vi.mock('../../../features/worktree/worktree', () => ({
  listBranchCommits: (path: string) => commitsSpy(path as never),
}));

const listSpy = vi.fn(async (args: unknown) => {
  const relPath = String((args as { readonly relPath?: string } | null)?.relPath ?? '');
  return relPath === ''
    ? [{ name: 'tailwind.config.ts', relPath: 'tailwind.config.ts', isDir: false }]
    : [];
});
const readSpy = vi.fn(async ({ relPath }: { readonly relPath: string }) => {
  if (relPath === 'tailwind.config.ts') {
    return { type: 'text' as const, text: 'export default {};', truncated: false };
  }
  throw new Error('missing');
});

vi.mock('../../../features/explore/explore', () => ({
  exploreList: (args: unknown) => listSpy(args),
  exploreRead: (args: unknown) => readSpy(args as never),
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
const NOW = '2026-09-15T10:00:00.000Z' as IsoDateTime;
const RUN_ID = 'run-1' as WorkflowRunId;

const session: Session = {
  id: SESSION_ID,
  workspaceId: 'ws-1' as WorkspaceId,
  goal: 'ship the wireframe role',
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
        name: 'scout',
        status: 'completed',
      },
    ],
  },
  transcripts: {
    [AGENT_ID]: [
      { kind: 'assistant_text', runId: 'r1', delta: 'the inbox lists sessions', at: NOW },
    ],
  },
  sessionArtifacts: {},
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

describe('spawnWireframeAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('spawns a standalone wireframe agent with no step, run or parent linkage', async () => {
    await spawnWireframeAgent(getWith())({
      sessionId: SESSION_ID,
      attachments: [],
      fidelity: 'low',
    });
    const args = spawnAgentSpy.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(spawnAgentSpy.mock.calls[0]?.[0]).toBe(SESSION_ID);
    expect(args['kindOverride']).toBe('wireframe');
    expect(args['stepId']).toBeUndefined();
    expect(args['workflowRunId']).toBeUndefined();
    expect(args['parentAgentId']).toBeUndefined();
  });

  it('scopes the evidence to a run without joining the agent to it', async () => {
    await spawnWireframeAgent(getWith())({
      sessionId: SESSION_ID,
      attachments: [],
      fidelity: 'low',
      workflowRunId: RUN_ID,
    });
    const args = spawnAgentSpy.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(args['workflowRunId']).toBeUndefined();
  });

  it('keeps a re-spawn from a supplied evidence pack standalone', async () => {
    await spawnWireframeAgent(getWith())({
      sessionId: SESSION_ID,
      attachments: [],
      fidelity: 'low',
      workflowRunId: RUN_ID,
      evidence: 'the original kickoff',
    });
    const args = spawnAgentSpy.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(args['workflowRunId']).toBeUndefined();
    expect(args['initialPrompt']).toBe('the original kickoff');
  });

  it('spawns without taking focus when asked', async () => {
    await spawnWireframeAgent(getWith())({
      sessionId: SESSION_ID,
      attachments: [],
      fidelity: 'low',
      focus: 'none',
    });
    const args = spawnAgentSpy.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(args['focus']).toBe('none');
  });

  it('carries the product evidence and the document contract in the kickoff', async () => {
    await spawnWireframeAgent(getWith())({
      sessionId: SESSION_ID,
      attachments: [],
      fidelity: 'low',
    });
    const prompt = String(
      (spawnAgentSpy.mock.calls[0]?.[1] as Record<string, unknown>)['initialPrompt'],
    );
    expect(prompt).toContain('ship the wireframe role');
    expect(prompt).toContain('the inbox lists sessions');
    expect(prompt).toContain('document contract');
    expect(prompt).toContain('"initialScreenId"');
  });

  it('carries the goal the user wrote into the kickoff pack, not the clamped title', async () => {
    await spawnWireframeAgent(withGoalSlot())({
      sessionId: SESSION_ID,
      attachments: [],
      fidelity: 'low',
    });
    const prompt = String(
      (spawnAgentSpy.mock.calls[0]?.[1] as Record<string, unknown>)['initialPrompt'],
    );
    expect(prompt).toContain(`## goal\n\n${LONG_GOAL}`);
    expect(prompt).toContain(`session title: ${session.goal}`);
  });

  it('sends the title alone as the goal when no goal slot says more', async () => {
    await spawnWireframeAgent(getWith())({
      sessionId: SESSION_ID,
      attachments: [],
      fidelity: 'low',
    });
    const prompt = String(
      (spawnAgentSpy.mock.calls[0]?.[1] as Record<string, unknown>)['initialPrompt'],
    );
    expect(prompt).not.toContain('## goal');
    expect(prompt).toContain(`session goal: ${session.goal}`);
  });

  it('skips the design profile at low fidelity', async () => {
    await spawnWireframeAgent(getWith())({
      sessionId: SESSION_ID,
      attachments: [],
      fidelity: 'low',
    });
    expect(readSpy).not.toHaveBeenCalled();
    const prompt = String(
      (spawnAgentSpy.mock.calls[0]?.[1] as Record<string, unknown>)['initialPrompt'],
    );
    expect(prompt).toContain('low fidelity wireframe');
    expect(prompt).toContain('set theme.name to "generic"');
  });

  it('adds a redacted brief while retaining product evidence, design profile and contract', async () => {
    await spawnWireframeAgent(getWith())({
      sessionId: SESSION_ID,
      attachments: [],
      fidelity: 'high',
      brief: 'show the Harborline inbox with api_key=harborline-test-value',
    });
    const prompt = String(spawnAgentSpy.mock.calls[0]?.[1]['initialPrompt']);
    expect(prompt).toContain('# user request\n\nshow the Harborline inbox with api_key=[redacted]');
    expect(prompt).not.toContain('harborline-test-value');
    expect(prompt).toContain('the inbox lists sessions');
    expect(prompt).toContain('commit: abcdef1');
    expect(prompt).toContain('document contract');
  });

  it('collects a pinned design profile at high fidelity', async () => {
    await spawnWireframeAgent(getWith())({
      sessionId: SESSION_ID,
      attachments: [],
      fidelity: 'high',
    });
    expect(readSpy).toHaveBeenCalled();
    const prompt = String(
      (spawnAgentSpy.mock.calls[0]?.[1] as Record<string, unknown>)['initialPrompt'],
    );
    expect(prompt).toContain('design profile');
    expect(prompt).toContain('commit: abcdef1');
    expect(prompt).toContain('tailwind.config.ts');
  });

  it('falls back to a generic theme when high fidelity has no mount', async () => {
    const get = getWith({ sessionProjectMounts: {}, sessionActiveMount: {} });
    await spawnWireframeAgent(get)({ sessionId: SESSION_ID, attachments: [], fidelity: 'high' });
    const prompt = String(
      (spawnAgentSpy.mock.calls[0]?.[1] as Record<string, unknown>)['initialPrompt'],
    );
    expect(prompt).toContain('no repository is mounted, so nothing could be read');
  });

  it('reuses a supplied evidence pack for a re-spawn', async () => {
    await spawnWireframeAgent(getWith())({
      sessionId: SESSION_ID,
      attachments: [],
      fidelity: 'high',
      evidence: 'the original kickoff',
    });
    const args = spawnAgentSpy.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(args['initialPrompt']).toBe('the original kickoff');
    expect(readSpy).not.toHaveBeenCalled();
  });

  it('records the source run without an executing run for a run scoped wireframe', async () => {
    await spawnWireframeAgent(getWith())({
      sessionId: SESSION_ID,
      attachments: [],
      fidelity: 'high',
      workflowRunId: RUN_ID,
      brief: 'show the Harborline inbox',
    });
    const recorded = recordProvenanceSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(recorded['agentId']).toBe(AGENT_ID);
    expect(recorded['kind']).toBe('wireframe');
    expect(recorded['brief']).toBe('show the Harborline inbox');
    expect(recorded['sourceWorkflowRunId']).toBe(RUN_ID);
    expect(recorded['executingWorkflowRunId']).toBeNull();
    expect(String(recorded['designProfileSummary'])).toContain('commit: abcdef1');
  });

  it('records no design profile at low fidelity and no run outside a workflow', async () => {
    await spawnWireframeAgent(getWith())({
      sessionId: SESSION_ID,
      attachments: [],
      fidelity: 'low',
    });
    const recorded = recordProvenanceSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(recorded['designProfileSummary']).toBeNull();
    expect(recorded['sourceWorkflowRunId']).toBeNull();
    expect(recorded['executingWorkflowRunId']).toBeNull();
    expect(recorded['evidence']).toEqual([
      { kind: 'session', id: SESSION_ID, label: 'ship the wireframe role' },
      { kind: 'agent', id: AGENT_ID, label: 'scout' },
    ]);
  });

  it('still spawns when provenance cannot be written', async () => {
    recordProvenanceSpy.mockRejectedValueOnce(new Error('database is locked'));
    const agentId = await spawnWireframeAgent(getWith())({
      sessionId: SESSION_ID,
      attachments: [],
      fidelity: 'low',
    });
    expect(agentId).toBe(AGENT_ID);
  });

  it('collects fresh evidence and provenance when the supplied pack is whitespace', async () => {
    await spawnWireframeAgent(getWith())({
      sessionId: SESSION_ID,
      attachments: [],
      fidelity: 'high',
      evidence: ' \n ',
    });
    expect(readSpy).toHaveBeenCalled();
    expect(spawnAgentSpy.mock.calls[0]?.[1]['initialPrompt']).toContain('design profile');
    expect(recordProvenanceSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: AGENT_ID,
        executingWorkflowRunId: null,
      }),
    );
  });

  it('throws when the session is unknown', async () => {
    await expect(
      spawnWireframeAgent(getWith({ sessions: [] }))({
        sessionId: SESSION_ID,
        attachments: [],
        fidelity: 'low',
      }),
    ).rejects.toThrow('session not found');
  });
});

describe('resolveWireframeRouting', () => {
  it('routes low fidelity at standard effort and high fidelity heavier', () => {
    const low = resolveWireframeRouting({
      state: getWith()(),
      sessionId: SESSION_ID,
      fidelity: 'low',
      picked: null,
    });
    const high = resolveWireframeRouting({
      state: getWith()(),
      sessionId: SESSION_ID,
      fidelity: 'high',
      picked: null,
    });
    expect(low.effort).toBe('medium');
    expect(high.effort).toBe('high');
  });

  it('honours an explicit pick over the default', () => {
    const picked = { provider: 'codex', model: 'gpt-5.6-sol', effort: 'low' } as const;
    expect(
      resolveWireframeRouting({
        state: getWith()(),
        sessionId: SESSION_ID,
        fidelity: 'high',
        picked,
      }),
    ).toEqual(picked);
  });

  it('honours a role model lock over the fidelity effort', () => {
    const state = getWith({
      workspaceOverrides: {
        'ws-1': {
          roleModels: { wireframe: { providerId: 'anthropic', model: 'haiku-4.5', effort: 'low' } },
        },
      },
    })();
    const routing = resolveWireframeRouting({
      state,
      sessionId: SESSION_ID,
      fidelity: 'high',
      picked: null,
    });
    expect(routing.model).toBe('haiku-4.5');
    expect(routing.effort).toBe('low');
  });

  it('skips a budget blocked provider', () => {
    const state = getWith({
      budgetAlerts: [{ kind: 'provider-exceeded', provider: 'anthropic' }],
    })();
    const routing = resolveWireframeRouting({
      state,
      sessionId: SESSION_ID,
      fidelity: 'low',
      picked: null,
    });
    expect(routing.provider).toBe('codex');
  });

  it('skips a provider in cooldown', () => {
    const state = getWith({ providerCooldowns: { anthropic: Date.now() + 60_000 } })();
    const routing = resolveWireframeRouting({
      state,
      sessionId: SESSION_ID,
      fidelity: 'low',
      picked: null,
    });
    expect(routing.provider).toBe('codex');
  });
});
