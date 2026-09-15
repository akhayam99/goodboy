import { describe, expect, it } from 'vitest';
import type {
  Agent,
  AgentId,
  ArtifactId,
  IsoDateTime,
  PlanArtifact,
  SessionId,
} from '@goodboy/types';
import { collectReportSourceLinks } from './reportSourceLinks';

const SESSION_ID = 'session-1' as SessionId;
const NOW = '2026-09-15T10:00:00.000Z' as IsoDateTime;

const agent: Agent = {
  id: 'agent-7' as AgentId,
  sessionId: SESSION_ID,
  ordinal: 0,
  name: 'implementer',
  status: 'completed',
};

const plan: PlanArtifact = {
  id: 'plan-3' as ArtifactId,
  sessionId: SESSION_ID,
  agentId: agent.id,
  workflowRunId: null,
  kind: 'plan',
  schemaVersion: 1,
  title: 'Rollout plan',
  sourceFormat: 'markdown',
  sourceText: 'body',
  metadata: {},
  status: 'active',
  revision: 1,
  sourceTurnId: null,
  createdAt: NOW,
  updatedAt: NOW,
};

describe('collectReportSourceLinks', () => {
  it('links only the ids the report actually cites', () => {
    const links = collectReportSourceLinks({
      sourceText: 'agent-7 did the work against plan-3',
      agents: [agent, { ...agent, id: 'agent-9' as AgentId, name: 'scout' }],
      artifacts: [plan],
      excludeArtifactId: 'report-1',
    });
    expect(links).toEqual([
      { kind: 'agent', id: 'agent-7', label: 'implementer' },
      { kind: 'artifact', id: 'plan-3', label: 'Rollout plan' },
    ]);
  });

  it('never links the report back to itself', () => {
    const links = collectReportSourceLinks({
      sourceText: 'see report-1',
      agents: [],
      artifacts: [{ ...plan, id: 'report-1' as ArtifactId }],
      excludeArtifactId: 'report-1',
    });
    expect(links).toEqual([]);
  });
});
