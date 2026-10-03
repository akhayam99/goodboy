import { describe, expect, it } from 'vitest';
import type { AgentId, ArtifactId, SessionId, WorkflowRunId } from '@goodboy/types';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { markArtifactOpened } from './artifact-orphan';
import {
  deleteArtifact,
  getArtifact,
  insertArtifact,
  listArtifactMirrorPage,
  listArtifactsForSession,
  removeArtifact,
  restoreArtifact,
  setArtifactStatus,
  updateArtifactSource,
} from './artifact';

const sessionId = 'session' as SessionId;
const agentId = 'agent' as AgentId;
const runId = 'run-1' as WorkflowRunId;

const seed = async (): Promise<Database> => {
  const db = await makeMigratedTestDatabase();
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Workspace', 'workspace', 1, 1)",
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session', 'workspace', 'Goal', 'idle', 1, 1)",
  );
  await db.execute(
    "INSERT INTO workflows (id, workspace_id, name, created_at, updated_at) VALUES ('workflow', 'workspace', 'Flow', 1, 1)",
  );
  await db.execute(
    `INSERT INTO session_workflows (workflow_run_id, session_id, workflow_id, ordinal, current_step_ordinal, created_at)
     VALUES ('run-1', 'session', 'workflow', 0, 0, 1)`,
  );
  await db.execute(
    "INSERT INTO agents (id, session_id, ordinal, name, status) VALUES ('agent', 'session', 0, 'Planner', 'completed')",
  );
  return db;
};

const insertReport = async (db: Database, id: string) =>
  insertArtifact({
    db,
    input: {
      id: id as ArtifactId,
      sessionId,
      agentId,
      kind: 'report',
      schemaVersion: 1,
      title: 'Session report',
      sourceFormat: 'markdown',
      sourceText: '## Outcome',
      metadata: { reportType: 'session-summary' },
    },
  });

describe('artifact queries', () => {
  it('round-trips a report artifact', async () => {
    const db = await seed();
    const created = await insertReport(db, 'report-1');
    expect(created.kind).toBe('report');
    expect(created.revision).toBe(1);
    expect(created.status).toBe('active');
    const loaded = await getArtifact({ db, artifactId: 'report-1' as ArtifactId });
    expect(loaded).toEqual(created);
  });

  it('lists artifacts by session', async () => {
    const db = await seed();
    await insertReport(db, 'report-1');
    await insertArtifact({
      db,
      input: {
        id: 'wireframe-1' as ArtifactId,
        sessionId,
        agentId,
        workflowRunId: runId,
        kind: 'wireframe',
        schemaVersion: 1,
        title: 'Rail',
        sourceFormat: 'json',
        sourceText: '{"nodes":[]}',
        metadata: { fidelity: 'low', designProfile: {} },
      },
    });
    const forSession = await listArtifactsForSession({ db, sessionId });
    expect(forSession.map((artifact) => artifact.id)).toEqual(['report-1', 'wireframe-1']);
  });

  it('rejects metadata that does not match the kind', async () => {
    const db = await seed();
    await expect(
      insertArtifact({
        db,
        input: {
          id: 'wireframe-2' as ArtifactId,
          sessionId,
          agentId,
          kind: 'wireframe',
          schemaVersion: 1,
          title: 'Rail',
          sourceFormat: 'json',
          sourceText: '{}',
          metadata: { reportType: 'nope' } as never,
        },
      }),
    ).rejects.toThrow('Invalid wireframe artifact metadata');
  });

  it('bumps the revision and keeps the previous one on source updates', async () => {
    const db = await seed();
    await insertReport(db, 'report-1');
    const updated = await updateArtifactSource({
      db,
      input: {
        id: 'report-1' as ArtifactId,
        title: 'Session report v2',
        sourceFormat: 'markdown',
        sourceText: '## Outcome v2',
        metadata: { reportType: 'session-summary' },
      },
    });
    expect(updated.revision).toBe(2);
    expect(updated.title).toBe('Session report v2');
    const kept = await db.select<{ readonly revision: number }>(
      'SELECT revision FROM artifact_revisions WHERE artifact_id = ? ORDER BY revision',
      ['report-1'],
    );
    expect(kept).toEqual([{ revision: 1 }, { revision: 2 }]);
  });

  it('discards, restores and removes', async () => {
    const db = await seed();
    await insertReport(db, 'report-1');
    await deleteArtifact({ db, artifactId: 'report-1' as ArtifactId });
    expect((await getArtifact({ db, artifactId: 'report-1' as ArtifactId }))?.status).toBe(
      'discarded',
    );
    await restoreArtifact({ db, artifactId: 'report-1' as ArtifactId });
    expect((await getArtifact({ db, artifactId: 'report-1' as ArtifactId }))?.status).toBe(
      'active',
    );
    await setArtifactStatus({
      db,
      artifactId: 'report-1' as ArtifactId,
      status: 'superseded',
    });
    expect((await getArtifact({ db, artifactId: 'report-1' as ArtifactId }))?.status).toBe(
      'superseded',
    );
    await removeArtifact({ db, artifactId: 'report-1' as ArtifactId });
    expect(await getArtifact({ db, artifactId: 'report-1' as ArtifactId })).toBeNull();
  });

  it('reads when an artifact was first opened, and nothing before', async () => {
    const db = await seed();
    await insertReport(db, 'report-1');
    expect((await getArtifact({ db, artifactId: 'report-1' as ArtifactId }))?.openedAt).toBeNull();
    await markArtifactOpened({ db, artifactId: 'report-1' as ArtifactId, openedAt: 900 });
    const [listed] = await listArtifactsForSession({ db, sessionId });
    expect(listed?.openedAt).toBe(new Date(900).toISOString());
  });

  it('refuses to consume a report', async () => {
    const db = await seed();
    await insertReport(db, 'report-1');
    await expect(
      setArtifactStatus({ db, artifactId: 'report-1' as ArtifactId, status: 'consumed' }),
    ).rejects.toThrow();
  });
});

describe('listArtifactMirrorPage', () => {
  it('walks every artifact once, in pages, with its workspace slug', async () => {
    const db = await seed();
    for (const id of ['report-1', 'report-2', 'report-3', 'report-4', 'report-5']) {
      await insertReport(db, id);
    }
    const seen: string[] = [];
    let page = await listArtifactMirrorPage({ db, after: null, limit: 2 });
    const sizes = [page.rows.length];
    seen.push(...page.rows.map((row) => row.artifact.id));
    while (page.next !== null) {
      page = await listArtifactMirrorPage({ db, after: page.next, limit: 2 });
      sizes.push(page.rows.length);
      seen.push(...page.rows.map((row) => row.artifact.id));
    }
    expect(sizes).toEqual([2, 2, 1]);
    expect([...seen].sort()).toEqual(['report-1', 'report-2', 'report-3', 'report-4', 'report-5']);
    expect(page.rows[0]?.workspaceSlug).toBe('workspace');
  });

  it('ends at once on an empty database', async () => {
    const db = await seed();
    expect(await listArtifactMirrorPage({ db, after: null, limit: 10 })).toEqual({
      rows: [],
      next: null,
    });
  });
});
