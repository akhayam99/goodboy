import { describe, expect, it } from 'vitest';
import type { Agent, AgentId, SessionArtifact } from '@goodboy/types';
import { resolveArtifactGenerations } from './artifactCollection';

const agent = (patch: Partial<Agent>): Agent =>
  ({
    id: 'agent-1',
    sessionId: 'sess-1',
    ordinal: 1,
    name: 'Session summary',
    status: 'completed',
    kind: 'report',
    ...patch,
  }) as Agent;

const artifactOf = (patch: Partial<SessionArtifact>): SessionArtifact =>
  ({
    id: 'artifact-1',
    sessionId: 'sess-1',
    agentId: 'agent-1',
    workflowRunId: null,
    kind: 'report',
    schemaVersion: 1,
    title: 'Harborline release report',
    sourceFormat: 'markdown',
    sourceText: 'shipped',
    metadata: { reportType: 'session-summary' },
    status: 'active',
    revision: 1,
    sourceTurnId: null,
    createdAt: '2026-01-02T03:04:05.000Z',
    updatedAt: '2026-01-02T03:04:05.000Z',
    ...patch,
  }) as SessionArtifact;

const noneActive: ReadonlySet<AgentId> = new Set();

describe('resolveArtifactGenerations', () => {
  it('ignores agents that are not report or wireframe agents', () => {
    const rows = resolveArtifactGenerations({
      agents: [agent({ kind: 'implementer' })],
      artifacts: [],
      activeAgentIds: noneActive,
      runningAgentIds: noneActive,
    });
    expect(rows).toEqual([]);
  });

  it('ignores an agent whose artifact already arrived', () => {
    const rows = resolveArtifactGenerations({
      agents: [agent({})],
      artifacts: [artifactOf({})],
      activeAgentIds: noneActive,
      runningAgentIds: noneActive,
    });
    expect(rows).toEqual([]);
  });

  it('reports a running agent as generating', () => {
    const rows = resolveArtifactGenerations({
      agents: [agent({ status: 'running' })],
      artifacts: [],
      activeAgentIds: noneActive,
      runningAgentIds: noneActive,
    });
    expect(rows[0]?.state).toBe('generating');
  });

  it('reports a pending agent with a live turn as generating', () => {
    const rows = resolveArtifactGenerations({
      agents: [agent({ status: 'pending' })],
      artifacts: [],
      activeAgentIds: new Set(['agent-1' as AgentId]),
      runningAgentIds: noneActive,
    });
    expect(rows[0]?.state).toBe('generating');
  });

  it('treats a queued agent that never finished a turn as generating', () => {
    const rows = resolveArtifactGenerations({
      agents: [agent({ status: 'pending' })],
      artifacts: [],
      activeAgentIds: noneActive,
      runningAgentIds: noneActive,
    });
    expect(rows[0]?.state).toBe('generating');
  });

  it('treats a stale pending leftover that already finished a turn as unproduced', () => {
    const rows = resolveArtifactGenerations({
      agents: [
        agent({
          status: 'pending',
          lastFinishedAt: '2026-01-02T03:04:05.000Z' as Agent['lastFinishedAt'],
        }),
      ],
      artifacts: [],
      activeAgentIds: noneActive,
      runningAgentIds: noneActive,
    });
    expect(rows[0]?.state).toBe('unproduced');
  });

  it('reports a finished report agent with no artifact as unproduced', () => {
    const rows = resolveArtifactGenerations({
      agents: [agent({ id: 'agent-9' as AgentId, name: 'Session summary' })],
      artifacts: [],
      activeAgentIds: noneActive,
      runningAgentIds: noneActive,
    });
    expect(rows).toEqual([
      {
        agentId: 'agent-9',
        kind: 'report',
        title: 'Session summary',
        state: 'unproduced',
        startedAt: null,
        provider: null,
        model: null,
        isTurnRunning: false,
        scouts: [],
        canStop: false,
      },
    ]);
  });

  it('reports a failed wireframe agent under the wireframe kind', () => {
    const rows = resolveArtifactGenerations({
      agents: [agent({ kind: 'wireframe', status: 'failed', name: 'Low fidelity' })],
      artifacts: [],
      activeAgentIds: noneActive,
      runningAgentIds: noneActive,
    });
    expect(rows[0]?.kind).toBe('wireframe');
    expect(rows[0]?.state).toBe('unproduced');
  });

  it('skips a deleted agent', () => {
    const rows = resolveArtifactGenerations({
      agents: [agent({ deletedAt: '2026-01-02T03:04:05.000Z' as Agent['deletedAt'] })],
      artifacts: [],
      activeAgentIds: noneActive,
      runningAgentIds: noneActive,
    });
    expect(rows).toEqual([]);
  });
});
