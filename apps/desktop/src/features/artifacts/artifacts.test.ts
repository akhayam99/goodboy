import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentId, IsoDateTime, ArtifactId, SessionArtifact, SessionId } from '@goodboy/types';

vi.mock('../../shared/lib/db', () => ({ tauriDatabase: { execute: vi.fn(), select: vi.fn() } }));

const { getArtifactBySourceTurn, insertArtifact } = vi.hoisted(() => ({
  getArtifactBySourceTurn: vi.fn(),
  insertArtifact: vi.fn(),
}));

vi.mock('@goodboy/db', () => ({
  deleteArtifact: vi.fn(),
  getArtifactBySourceTurn,
  insertArtifact,
  listArtifactsForSession: vi.fn(),
  restoreArtifact: vi.fn(),
  setArtifactStatus: vi.fn(),
  updateArtifactSource: vi.fn(),
}));

import { createArtifact } from './artifacts';

const SESSION_ID = 'session-1' as SessionId;
const AGENT_ID = 'agent-1' as AgentId;
const SOURCE_TURN_ID = 'run-1';

const stored: SessionArtifact = {
  id: 'artifact-1' as ArtifactId,
  sessionId: SESSION_ID,
  agentId: AGENT_ID,
  workflowRunId: null,
  kind: 'report',
  schemaVersion: 1,
  title: 'Session report',
  sourceFormat: 'markdown',
  sourceText: '## Outcome',
  metadata: { reportType: 'session-summary' },
  status: 'active',
  revision: 1,
  sourceTurnId: SOURCE_TURN_ID,
  createdAt: '2026-01-01T00:00:00.000Z' as IsoDateTime,
  updatedAt: '2026-01-01T00:00:00.000Z' as IsoDateTime,
};

const create = async () =>
  createArtifact({
    sessionId: SESSION_ID,
    agentId: AGENT_ID,
    kind: 'report',
    schemaVersion: 1,
    title: 'Session report',
    sourceFormat: 'markdown',
    sourceText: '## Outcome',
    metadata: { reportType: 'session-summary' },
    sourceTurnId: SOURCE_TURN_ID,
  });

beforeEach(() => {
  getArtifactBySourceTurn.mockReset();
  insertArtifact.mockReset();
});

describe('createArtifact replay safety', () => {
  it('returns the stored artifact without inserting a second row', async () => {
    getArtifactBySourceTurn.mockResolvedValue(stored);

    const result = await create();

    expect(result).toBe(stored);
    expect(insertArtifact).not.toHaveBeenCalled();
  });

  it('returns the winning row when the unique constraint rejects the insert', async () => {
    getArtifactBySourceTurn.mockResolvedValueOnce(null).mockResolvedValueOnce(stored);
    insertArtifact.mockRejectedValue(
      new Error('UNIQUE constraint failed: session_artifacts.agent_id, source_turn_id'),
    );

    const result = await create();

    expect(result).toBe(stored);
    expect(insertArtifact).toHaveBeenCalledTimes(1);
  });

  it('rethrows an insert failure that is not a replay of the same turn', async () => {
    getArtifactBySourceTurn.mockResolvedValue(null);
    insertArtifact.mockRejectedValue(new Error('database is locked'));

    await expect(create()).rejects.toThrow('database is locked');
  });
});
