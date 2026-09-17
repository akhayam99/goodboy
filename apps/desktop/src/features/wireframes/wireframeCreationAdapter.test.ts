import { describe, expect, it, vi, type Mock } from 'vitest';
import type {
  AgentId,
  IsoDateTime,
  MountId,
  ProviderId,
  SessionId,
  WorkflowRunId,
} from '@goodboy/types';
import type { ArtifactSpawnActions } from '../artifacts/artifactCreationAdapter';
import type { AppStore } from '../../store/store';
import type { ArtifactWireframeDraft } from '../../store/slices/artifactDrafts/types';
import { wireframeCreationAdapter } from './wireframeCreationAdapter';

const SESSION_ID = 'session-harborline' as SessionId;
const RUN_ID = 'run-northwind-2' as WorkflowRunId;
const NOW = '2026-09-16T10:00:00.000Z' as IsoDateTime;
const MOUNTS = ['mount-web' as MountId, 'mount-api' as MountId];

const draft = (overrides: Partial<ArtifactWireframeDraft> = {}): ArtifactWireframeDraft => ({
  kind: 'wireframe',
  fidelity: 'low',
  target: 'both',
  brief: '',
  attachments: [],
  mountIds: [],
  basedOn: { kind: 'session' },
  routing: null,
  updatedAt: NOW,
  ...overrides,
});

const actions = (): ArtifactSpawnActions & {
  readonly spawnReportAgent: Mock;
  readonly spawnWireframeAgent: Mock;
} => ({
  spawnReportAgent: vi.fn(async () => 'agent-report' as AgentId),
  spawnWireframeAgent: vi.fn(async () => 'agent-wireframe' as AgentId),
});

const routingState = (): AppStore =>
  ({
    sessions: [],
    workspaceOverrides: {},
    providers: [{ id: 'anthropic' as ProviderId, connection: 'connected' }],
    providerCooldowns: {},
    budgetAlerts: [],
  }) as unknown as AppStore;

describe('wireframeCreationAdapter', () => {
  it('passes the draft to the spawn without focus and without evidence', async () => {
    const spies = actions();
    await wireframeCreationAdapter.spawn({
      actions: spies,
      sessionId: SESSION_ID,
      draft: draft({
        fidelity: 'high',
        brief: 'the settlement review flow',
        mountIds: MOUNTS,
        basedOn: { kind: 'workflow-run', workflowRunId: RUN_ID },
      }),
    });
    expect(spies.spawnWireframeAgent).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      fidelity: 'high',
      target: 'both',
      workflowRunId: RUN_ID,
      routing: null,
      brief: 'the settlement review flow',
      attachments: [],
      mountIds: MOUNTS,
      focus: 'none',
    });
    expect(spies.spawnReportAgent).not.toHaveBeenCalled();
  });

  it('resolves the wireframe default effort from the fidelity', () => {
    const low = wireframeCreationAdapter.resolveRouting({
      state: routingState(),
      sessionId: SESSION_ID,
      choice: 'low',
    });
    const high = wireframeCreationAdapter.resolveRouting({
      state: routingState(),
      sessionId: SESSION_ID,
      choice: 'high',
    });
    expect(low.effort).toBe('medium');
    expect(high.effort).toBe('high');
  });

  it('says a low fidelity wireframe reads no design files', () => {
    expect(
      wireframeCreationAdapter.repoLine({
        choice: 'low',
        repo: { mountName: 'ledger-core', branch: 'ak/fix-rounding', baseBranch: 'main' },
      }),
    ).toBe('plain wireframe, no design files read.');
    expect(wireframeCreationAdapter.repoLine({ choice: 'high', repo: null })).toBe(
      'no mounted project, so the generic theme is used.',
    );
  });
});
