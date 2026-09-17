import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  AgentId,
  ArtifactId,
  IsoDateTime,
  Session,
  SessionArtifact,
  SessionId,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';

vi.mock('../../shared/lib/db', () => ({ tauriDatabase: { execute: vi.fn(), select: vi.fn() } }));

const { putArtifactProvenance, getArtifactProvenance, updateArtifactRun } = vi.hoisted(() => ({
  putArtifactProvenance: vi.fn(),
  getArtifactProvenance: vi.fn(),
  updateArtifactRun: vi.fn(),
}));

vi.mock('@goodboy/db', () => ({
  putArtifactProvenance,
  getArtifactProvenance,
  updateArtifactRun,
}));

import {
  artifactEvidenceInventory,
  completeArtifactRun,
  loadArtifactProvenance,
  recordArtifactProvenance,
} from './artifactProvenance';

const NOW = '2026-09-15T10:00:00.000Z' as IsoDateTime;
const SESSION_ID = 'session-1' as SessionId;
const AGENT_ID = 'agent-1' as AgentId;
const RUN_ID = 'run-1' as WorkflowRunId;

const session: Session = {
  id: SESSION_ID,
  workspaceId: 'ws-1' as WorkspaceId,
  goal: 'ship notify-relay',
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

const agent: Agent = {
  id: AGENT_ID,
  sessionId: SESSION_ID,
  ordinal: 0,
  name: 'Harborline reviewer',
  status: 'completed',
};

const artifact: SessionArtifact = {
  id: 'artifact-1' as ArtifactId,
  sessionId: SESSION_ID,
  agentId: AGENT_ID,
  workflowRunId: null,
  kind: 'plan',
  schemaVersion: 1,
  title: 'ledger-core rollout',
  sourceFormat: 'markdown',
  sourceText: '## steps',
  metadata: {},
  status: 'active',
  revision: 1,
  sourceTurnId: null,
  createdAt: NOW,
  updatedAt: NOW,
};

const inventory = (sourceIds: ReadonlyArray<string>, sourceWorkflowRunId: WorkflowRunId | null) =>
  artifactEvidenceInventory({
    sourceIds,
    session,
    agents: [agent],
    artifacts: [artifact],
    sourceWorkflowRunId,
  });

describe('artifactEvidenceInventory', () => {
  it('names the session, the agents, the artifacts and the run behind the pack', () => {
    expect(inventory([SESSION_ID, AGENT_ID, artifact.id, RUN_ID], RUN_ID)).toEqual([
      { kind: 'session', id: SESSION_ID, label: 'ship notify-relay' },
      { kind: 'agent', id: AGENT_ID, label: 'Harborline reviewer' },
      { kind: 'artifact', id: artifact.id, label: 'plan: ledger-core rollout' },
      { kind: 'workflow-run', id: RUN_ID, label: 'workflow run' },
    ]);
  });

  it('keeps an id it cannot resolve instead of dropping it', () => {
    expect(inventory(['gone-1'], null)).toEqual([
      { kind: 'unknown', id: 'gone-1', label: 'gone-1' },
    ]);
  });

  it('lists a repeated source once', () => {
    expect(inventory([AGENT_ID, AGENT_ID], null)).toEqual([
      { kind: 'agent', id: AGENT_ID, label: 'Harborline reviewer' },
    ]);
  });

  it('redacts a secret carried in a label', () => {
    const entries = artifactEvidenceInventory({
      sourceIds: [SESSION_ID],
      session: { ...session, goal: 'rotate api_key=harborline-test-value' },
      agents: [],
      artifacts: [],
      sourceWorkflowRunId: null,
    });
    expect(entries[0]?.label).toBe('rotate api_key=[redacted]');
  });
});

describe('recordArtifactProvenance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redacts the brief, the omissions and the design profile before writing', async () => {
    await recordArtifactProvenance({
      agentId: AGENT_ID,
      sessionId: SESSION_ID,
      kind: 'wireframe',
      brief: '  show the inbox, api_key=harborline-test-value  ',
      evidence: inventory([AGENT_ID], null),
      omissions: ['dropped password: harborline-test-value'],
      designProfileSummary: 'theme name: Harborline, secret=harborline-test-value',
      hasDesignEvidence: true,
      phase: 'producing',
      scoutPlan: [],
      mountIds: [],
      target: 'desktop',
      deadlineAt: null,
      sourceWorkflowRunId: RUN_ID,
      executingWorkflowRunId: null,
    });
    const input = putArtifactProvenance.mock.calls[0]?.[0]['input'] as Record<string, unknown>;
    expect(input['brief']).toBe('show the inbox, api_key=[redacted]');
    expect(input['omissions']).toEqual(['dropped password: [redacted]']);
    expect(String(input['designProfileSummary'])).toBe('theme name: Harborline, secret=[redacted]');
    expect(input['hasDesignEvidence']).toBe(true);
    expect(input['phase']).toBe('producing');
    expect(input['target']).toBe('desktop');
    expect(input['sourceWorkflowRunId']).toBe(RUN_ID);
    expect(input['executingWorkflowRunId']).toBeNull();
  });

  it('writes a blank brief as no brief', async () => {
    await recordArtifactProvenance({
      agentId: AGENT_ID,
      sessionId: SESSION_ID,
      kind: 'report',
      brief: '   ',
      evidence: [],
      omissions: [],
      designProfileSummary: null,
      hasDesignEvidence: false,
      phase: 'producing',
      scoutPlan: [],
      mountIds: [],
      target: null,
      deadlineAt: null,
      sourceWorkflowRunId: null,
      executingWorkflowRunId: null,
    });
    expect(putArtifactProvenance.mock.calls[0]?.[0]['input']['brief']).toBeNull();
  });
});

describe('loadArtifactProvenance', () => {
  it('returns nothing for a generation that recorded nothing', async () => {
    getArtifactProvenance.mockResolvedValueOnce(null);
    expect(await loadArtifactProvenance(AGENT_ID)).toBeNull();
  });
});

describe('completeArtifactRun', () => {
  const row = (phase: string) => ({
    agentId: AGENT_ID,
    phase,
    scoutPlan: [
      { roleId: 'diff-context', mountId: 'mount-1', root: '.', reason: 'r', agentId: null },
    ],
  });

  beforeEach(() => {
    updateArtifactRun.mockClear();
    getArtifactProvenance.mockReset();
  });

  it('marks a producing run done and keeps the roster on the row', async () => {
    getArtifactProvenance.mockResolvedValueOnce(row('producing'));
    await completeArtifactRun({ agentId: AGENT_ID });
    expect(updateArtifactRun.mock.calls[0]?.[0]['input']).toEqual({
      agentId: AGENT_ID,
      phase: 'done',
      scoutPlan: row('producing').scoutPlan,
    });
  });

  it('marks a gathering run done when the artifact arrived early', async () => {
    getArtifactProvenance.mockResolvedValueOnce(row('gathering'));
    await completeArtifactRun({ agentId: AGENT_ID });
    expect(updateArtifactRun.mock.calls[0]?.[0]['input']['phase']).toBe('done');
  });

  it('never reopens a run the user already stopped', async () => {
    getArtifactProvenance.mockResolvedValueOnce(row('failed'));
    await completeArtifactRun({ agentId: AGENT_ID });
    expect(updateArtifactRun).not.toHaveBeenCalled();
  });

  it('writes nothing for an agent with no run of its own', async () => {
    getArtifactProvenance.mockResolvedValueOnce(null);
    await completeArtifactRun({ agentId: AGENT_ID });
    expect(updateArtifactRun).not.toHaveBeenCalled();
  });
});
