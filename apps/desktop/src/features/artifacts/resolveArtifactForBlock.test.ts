import { describe, expect, it } from 'vitest';
import type {
  AgentId,
  ArtifactId,
  ArtifactKind,
  ArtifactStatus,
  ProviderRunId,
  SessionArtifact,
  SessionId,
} from '@goodboy/types';
import { resolveArtifactForBlock } from './resolveArtifactForBlock';

const SESSION_ID = 'session-1' as SessionId;
const SCOUT = 'agent-scout' as AgentId;
const OTHER = 'agent-other' as AgentId;

type Seed = Readonly<{
  id: string;
  agentId: AgentId;
  kind: ArtifactKind;
  sourceTurnId: string | null;
  status?: ArtifactStatus;
}>;

const artifactOf = ({
  id,
  agentId,
  kind,
  sourceTurnId,
  status = 'active',
}: Seed): SessionArtifact =>
  ({
    id: id as ArtifactId,
    sessionId: SESSION_ID,
    agentId,
    workflowRunId: null,
    kind,
    schemaVersion: 1,
    title: id,
    sourceFormat: kind === 'wireframe' ? 'json' : 'markdown',
    sourceText: '',
    metadata: {},
    status,
    revision: 1,
    sourceTurnId,
    createdAt: '2026-09-14T10:00:00.000Z',
    updatedAt: '2026-09-14T10:00:00.000Z',
  }) as unknown as SessionArtifact;

describe('resolveArtifactForBlock', () => {
  it('matches the artifact the run that wrote the block produced', () => {
    const report = artifactOf({ id: 'a1', agentId: SCOUT, kind: 'report', sourceTurnId: 'run-1' });
    const other = artifactOf({ id: 'a2', agentId: OTHER, kind: 'report', sourceTurnId: 'run-2' });

    expect(
      resolveArtifactForBlock({
        artifacts: [report, other],
        agentId: SCOUT,
        runId: 'run-1' as ProviderRunId,
        artifactKind: 'report',
      }),
    ).toBe(report);
  });

  it('points a revision block at the artifact the revision updated', () => {
    const first = artifactOf({ id: 'a1', agentId: SCOUT, kind: 'report', sourceTurnId: 'run-1' });

    expect(
      resolveArtifactForBlock({
        artifacts: [first],
        agentId: SCOUT,
        runId: 'run-2' as ProviderRunId,
        artifactKind: 'report',
      }),
    ).toBe(first);
  });

  it('skips a discarded artifact when it falls back on the agent', () => {
    const dropped = artifactOf({
      id: 'a1',
      agentId: SCOUT,
      kind: 'report',
      sourceTurnId: 'run-1',
      status: 'discarded',
    });

    expect(
      resolveArtifactForBlock({
        artifacts: [dropped],
        agentId: SCOUT,
        runId: 'run-2' as ProviderRunId,
        artifactKind: 'report',
      }),
    ).toBeNull();
  });

  it('gives an agent with no artifact of that kind nothing to open', () => {
    const wireframe = artifactOf({
      id: 'a1',
      agentId: SCOUT,
      kind: 'wireframe',
      sourceTurnId: 'run-1',
    });

    expect(
      resolveArtifactForBlock({
        artifacts: [wireframe],
        agentId: SCOUT,
        runId: 'run-9' as ProviderRunId,
        artifactKind: 'report',
      }),
    ).toBeNull();
  });

  it('resolves a plan only on its own run, never by falling back', () => {
    const plan = artifactOf({ id: 'a1', agentId: SCOUT, kind: 'plan', sourceTurnId: 'run-1' });

    expect(
      resolveArtifactForBlock({
        artifacts: [plan],
        agentId: SCOUT,
        runId: 'run-1' as ProviderRunId,
        artifactKind: 'plan',
      }),
    ).toBe(plan);
    expect(
      resolveArtifactForBlock({
        artifacts: [plan],
        agentId: SCOUT,
        runId: 'run-2' as ProviderRunId,
        artifactKind: 'plan',
      }),
    ).toBeNull();
  });

  it('gives the generic artifact kind nothing to open', () => {
    const report = artifactOf({ id: 'a1', agentId: SCOUT, kind: 'report', sourceTurnId: 'run-1' });

    expect(
      resolveArtifactForBlock({
        artifacts: [report],
        agentId: SCOUT,
        runId: 'run-1' as ProviderRunId,
        artifactKind: 'artifact',
      }),
    ).toBeNull();
  });

  it('gives a block still in flight nothing to open', () => {
    const report = artifactOf({ id: 'a1', agentId: SCOUT, kind: 'report', sourceTurnId: 'run-1' });

    expect(
      resolveArtifactForBlock({
        artifacts: [report],
        agentId: null,
        runId: null,
        artifactKind: 'report',
      }),
    ).toBeNull();
  });
});
