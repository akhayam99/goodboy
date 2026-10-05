// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type {
  AgentId,
  ArtifactId,
  ArtifactKind,
  ArtifactStatus,
  IsoDateTime,
  ProviderRunId,
  SessionArtifact,
  SessionId,
} from '@goodboy/types';
import { resolveArtifactForBlock, resolveReplacedPlan } from './resolveArtifactForBlock';

const SESSION_ID = 'session-1' as SessionId;
const SCOUT = 'agent-scout' as AgentId;
const OTHER = 'agent-other' as AgentId;

type Seed = Readonly<{
  id: string;
  agentId: AgentId;
  kind: ArtifactKind;
  sourceTurnId: string | null;
  status?: ArtifactStatus;
  title?: string;
  revision?: number;
}>;

const base = {
  sessionId: SESSION_ID,
  workflowRunId: null,
  schemaVersion: 1,
  sourceText: '',
  revision: 1,
  createdAt: '2026-09-14T10:00:00.000Z' as IsoDateTime,
  updatedAt: '2026-09-14T10:00:00.000Z' as IsoDateTime,
  openedAt: null,
};

const artifactOf = ({
  id,
  agentId,
  kind,
  sourceTurnId,
  status = 'active',
  title = id,
  revision = 1,
}: Seed): SessionArtifact => {
  const shared = {
    ...base,
    id: id as ArtifactId,
    agentId,
    title,
    status,
    sourceTurnId,
    revision,
  };
  if (kind === 'wireframe') {
    return {
      ...shared,
      kind: 'wireframe',
      sourceFormat: 'json',
      metadata: { fidelity: 'low', designProfile: {} },
    } satisfies SessionArtifact;
  }
  if (kind === 'report') {
    return {
      ...shared,
      kind: 'report',
      sourceFormat: 'markdown',
      metadata: { reportType: 'analysis' },
    } satisfies SessionArtifact;
  }
  return {
    ...shared,
    kind: 'plan',
    sourceFormat: 'markdown',
    metadata: {},
  } satisfies SessionArtifact;
};

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

  it('refuses a discarded artifact even when the run id still matches it', () => {
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
        runId: 'run-1' as ProviderRunId,
        artifactKind: 'report',
      }),
    ).toBeNull();
  });

  it('refuses to guess when the agent has more than one live artifact of that kind', () => {
    const first = artifactOf({ id: 'a1', agentId: SCOUT, kind: 'report', sourceTurnId: 'run-1' });
    const second = artifactOf({ id: 'a2', agentId: SCOUT, kind: 'report', sourceTurnId: 'run-2' });

    expect(
      resolveArtifactForBlock({
        artifacts: [first, second],
        agentId: SCOUT,
        runId: 'run-9' as ProviderRunId,
        artifactKind: 'report',
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

describe('resolveReplacedPlan', () => {
  const retry = artifactOf({
    id: 'p1',
    agentId: SCOUT,
    kind: 'plan',
    sourceTurnId: 'run-3',
    title: 'Retry-safe webhook credits',
    revision: 3,
  });
  const ledger = artifactOf({
    id: 'p2',
    agentId: SCOUT,
    kind: 'plan',
    sourceTurnId: 'run-5',
    title: 'Ledger export cutover',
    revision: 2,
  });
  const newer = { ...ledger, updatedAt: '2026-09-14T12:00:00.000Z' as IsoDateTime };

  it('opens the reworked plan whose title the old block carries, not the newest one', () => {
    const replaced = resolveReplacedPlan({
      artifacts: [retry, newer],
      agentId: SCOUT,
      ordinal: 1,
      title: 'Retry-safe webhook credits',
    });

    expect(replaced?.artifact).toBe(retry);
    expect(replaced?.latest).toBe(3);
  });

  it('refuses to guess when several reworked plans could own the block', () => {
    expect(
      resolveReplacedPlan({ artifacts: [retry, newer], agentId: SCOUT, ordinal: 1, title: null }),
    ).toBeNull();
    expect(
      resolveReplacedPlan({
        artifacts: [retry, newer],
        agentId: SCOUT,
        ordinal: 1,
        title: 'Payments backfill',
      }),
    ).toBeNull();
  });

  it('refuses when two reworked plans share the block title', () => {
    const twin = artifactOf({
      id: 'p3',
      agentId: SCOUT,
      kind: 'plan',
      sourceTurnId: 'run-6',
      title: 'Retry-safe webhook credits',
      revision: 2,
    });

    expect(
      resolveReplacedPlan({
        artifacts: [retry, twin],
        agentId: SCOUT,
        ordinal: 1,
        title: 'Retry-safe webhook credits',
      }),
    ).toBeNull();
  });

  it('keeps resolving when the block has no title and one plan was reworked', () => {
    expect(
      resolveReplacedPlan({ artifacts: [retry], agentId: SCOUT, ordinal: 1, title: null })
        ?.artifact,
    ).toBe(retry);
  });
});
