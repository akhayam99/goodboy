import { describe, expect, it } from 'vitest';
import type { ProjectId, SearchHit, SearchQuery, WorkspaceId, SessionId } from '@goodboy/types';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { SEARCH_WORLD, seedSearchWorld } from '../test-helpers/search-fixtures';
import {
  excludeProjectFromSearch,
  includeProjectInSearch,
  parseMarkedText,
  readSearchIndexStatus,
  searchIndex,
  toMatchExpression,
} from './search';
import { runSearchBackfillStep } from '../maintenance/searchBackfill';

const W = SEARCH_WORLD;

const QUERY: SearchQuery = {
  text: '',
  kinds: [],
  workspaceId: null,
  sessionId: null,
  projectIds: [],
  providers: [],
  statuses: [],
  after: null,
  before: null,
  archived: 'exclude',
  limit: 50,
};

type RunParams = {
  readonly db: Database;
  readonly query: Partial<SearchQuery>;
};

const run = async ({ db, query }: RunParams): Promise<ReadonlyArray<SearchHit>> =>
  searchIndex({ db, query: { ...QUERY, ...query }, now: W.now });

const ids = async (params: RunParams): Promise<ReadonlyArray<string>> =>
  (await run(params)).map((hit) => hit.docId);

const seeded = async (): Promise<Database> => {
  const db = await makeMigratedTestDatabase();
  await seedSearchWorld({ db });
  return db;
};

describe('search query', () => {
  it('builds a prefix match for every word and drops punctuation', () => {
    expect(toMatchExpression({ text: 'pay export' })).toBe('"pay"* "export"*');
    expect(toMatchExpression({ text: 'HAR-231 "drop" Tomás' })).toBe(
      '"har"* "231"* "drop"* "tomas"*',
    );
    expect(toMatchExpression({ text: '  ** ' })).toBeNull();
  });

  it('finds the payout export from "pay export", title matches first', async () => {
    const db = await seeded();
    const hits = await ids({ db, query: { text: 'pay export' } });
    expect(hits.slice(0, 4)).toEqual(
      expect.arrayContaining([
        'artifact:art-plan',
        'session:s-payout',
        'task:s-payout:linear:lin-231',
      ]),
    );
    expect(hits).not.toContain('message:msg-user');
  });

  it('marks the matched words in the title and the snippet', async () => {
    const db = await seeded();
    const [hit] = await run({ db, query: { text: 'lindqvist', kinds: ['message'] } });
    expect(
      hit?.snippet.filter((segment) => segment.isMatch).map((segment) => segment.text),
    ).toEqual(['Lindqvist']);
    expect(hit).toMatchObject({
      kind: 'message',
      refId: 'msg-user',
      sessionTitle: 'Speed up the payout export for large merchants',
      agentName: 'Payout builder',
      workspaceId: W.workspaceId,
      provider: 'codex',
    });
    const [session] = await run({ db, query: { text: 'merchants', kinds: ['session'] } });
    expect(session?.title).toEqual([
      { text: 'Speed up the payout export for large ', isMatch: false },
      { text: 'merchants', isMatch: true },
    ]);
  });

  it('never returns tool output or system messages', async () => {
    const db = await seeded();
    expect(await ids({ db, query: { text: 'private' } })).toEqual([]);
    const settlement = await ids({ db, query: { text: 'settlement', kinds: ['message'] } });
    expect(settlement).not.toContain('message:msg-system');
  });

  it('filters by type, workspace, session, project, provider, status and date', async () => {
    const db = await seeded();
    expect(await ids({ db, query: { text: 'settlement', kinds: ['decision'] } })).toEqual([
      'decision:dec-1',
    ]);
    expect(
      await ids({
        db,
        query: { text: 'settlement', workspaceId: W.otherWorkspaceId as WorkspaceId },
      }),
    ).toEqual(['message:msg-relay']);
    const scoped = await ids({
      db,
      query: { text: 'settlement', sessionId: W.sessionId as SessionId },
    });
    expect(scoped).not.toContain('message:msg-relay');
    expect(scoped).toContain('message:msg-user');
    expect(
      await ids({
        db,
        query: { text: 'settlement', projectIds: [W.otherProjectId as ProjectId] },
      }),
    ).toEqual(['message:msg-relay']);
    expect(await ids({ db, query: { text: 'settlement', providers: ['codex'] } })).toEqual([
      'message:msg-user',
      'message:msg-assistant',
      'artifact:art-plan',
    ]);
    expect(await ids({ db, query: { text: 'payout', statuses: ['open'], kinds: ['pr'] } })).toEqual(
      ['ghpr:harborline/ledger-core:ak/feat-payout-stream', 'mountpr:mpr-1'],
    );
    expect(
      await ids({ db, query: { text: 'payout', statuses: ['merged'], kinds: ['pr'] } }),
    ).toEqual([]);
    expect(
      await ids({
        db,
        query: { text: 'settlement', after: W.now - 2 * W.day, kinds: ['message'] },
      }),
    ).toEqual(['message:msg-relay']);
    expect(
      (
        await ids({
          db,
          query: { text: 'settlement', before: W.now - 2 * W.day, kinds: ['message'] },
        })
      )
        .slice()
        .sort(),
    ).toEqual(['message:msg-assistant', 'message:msg-user']);
  });

  it('lists the newest docs of a filter when there is no text', async () => {
    const db = await seeded();
    expect(await ids({ db, query: { kinds: ['session'] } })).toEqual([
      'session:s-relay',
      'session:s-payout',
    ]);
  });

  it('returns the decision number and the provider link of issues and pull requests', async () => {
    const db = await seeded();
    const [decision] = await run({ db, query: { text: 'settlement', kinds: ['decision'] } });
    expect(decision?.ordinal).toBe(1);
    const links = await run({ db, query: { text: 'payout', kinds: ['pr', 'issue'] } });
    expect(Object.fromEntries(links.map((hit) => [hit.docId, hit.url]))).toEqual({
      'ghpr:harborline/ledger-core:ak/feat-payout-stream':
        'https://github.com/harborline/ledger-core/pull/482',
      'mountpr:mpr-1': 'https://gitlab.example/mr/17',
      'task:s-payout:linear:lin-231': 'https://linear.app/harborline/issue/HAR-231',
    });
  });

  it('ties a pull request to the session whose mount has its branch', async () => {
    const db = await seeded();
    const hits = await run({ db, query: { text: 'payout', kinds: ['pr'] } });
    expect(hits.map((hit) => [hit.docId, hit.sessionId])).toEqual([
      ['ghpr:harborline/ledger-core:ak/feat-payout-stream', W.sessionId],
      ['mountpr:mpr-1', W.sessionId],
    ]);
  });

  it('hides archived sessions unless asked, and shows only them on is:archived', async () => {
    const db = await seeded();
    await db.execute(`UPDATE sessions SET archived_at = 1 WHERE id = '${W.sessionId}'`);
    expect(await ids({ db, query: { text: 'lindqvist' } })).toEqual([]);
    const archived = await run({ db, query: { text: 'settlement', archived: 'only' } });
    expect(archived.every((hit) => hit.isArchived)).toBe(true);
    expect(archived.map((hit) => hit.docId)).toContain('message:msg-user');
    const session = await run({
      db,
      query: { text: 'merchants', kinds: ['session'], archived: 'include' },
    });
    expect(session[0]?.status).toBe('archived');
  });

  it('hides tombstoned sessions, agents and workspaces', async () => {
    const db = await seeded();
    await db.execute(`UPDATE agents SET deleted_at = 1 WHERE id = '${W.otherAgentId}'`);
    expect(await ids({ db, query: { text: 'relay' } })).toEqual(['session:s-relay']);
    await db.execute(`UPDATE sessions SET deleted_at = 1 WHERE id = '${W.otherSessionId}'`);
    expect(await ids({ db, query: { text: 'relay' } })).toEqual([]);
    await db.execute(`UPDATE workspaces SET deleted_at = 1 WHERE id = '${W.workspaceId}'`);
    expect(await ids({ db, query: { text: 'drift' } })).toEqual([]);
  });

  it('finds workflows by name, description and step, and hides deleted ones', async () => {
    const db = await seeded();
    const hits = await run({ db, query: { text: 'rounding', kinds: ['workflow'] } });
    expect(hits.map((hit) => [hit.docId, hit.refId, hit.workspaceId])).toEqual([
      ['step:step-scout', 'wf-settle', W.workspaceId],
    ]);
    expect(await ids({ db, query: { text: 'hardening' } })).toEqual(['workflow:wf-settle']);
    await db.execute("UPDATE steps SET deleted_at = 1 WHERE id = 'step-scout'");
    expect(await ids({ db, query: { text: 'rounding' } })).toEqual([]);
    await db.execute("UPDATE workflows SET deleted_at = 1 WHERE id = 'wf-settle'");
    expect(await ids({ db, query: { text: 'hardening' } })).toEqual([]);
  });

  it('finds a diff comment with its file and session', async () => {
    const db = await seeded();
    const [hit] = await run({ db, query: { text: 'merchant tier' } });
    expect(hit).toMatchObject({
      docId: 'comment:c-1',
      kind: 'comment',
      sessionId: W.sessionId,
      container: 'src/export/stream.ts',
      status: 'open',
    });
  });

  it('ranks the newer of two equal matches first', async () => {
    const db = await seeded();
    await db.exec(`
      INSERT INTO messages (id, session_id, agent_id, role, content, created_at) VALUES
        ('old', '${W.sessionId}', '${W.agentId}', 'user', 'quarterly ledger close', ${W.now - 90 * W.day}),
        ('new', '${W.sessionId}', '${W.agentId}', 'user', 'quarterly ledger close', ${W.now - W.day});
    `);
    expect(await ids({ db, query: { text: 'quarterly' } })).toEqual(['message:new', 'message:old']);
  });

  it('excludes a project, then brings it back through the backfill', async () => {
    const db = await seeded();
    await excludeProjectFromSearch({ db, projectId: W.projectId as ProjectId, now: W.now });
    expect(await ids({ db, query: { text: 'lindqvist' } })).toEqual([]);
    await db.execute(
      `INSERT INTO messages (id, session_id, agent_id, role, content, created_at) VALUES ('late', '${W.sessionId}', '${W.agentId}', 'user', 'lindqvist again', 1)`,
    );
    expect(await ids({ db, query: { text: 'lindqvist' } })).toEqual([]);
    const status = await readSearchIndexStatus({ db });
    expect(status.excludedProjectIds).toEqual([W.projectId]);

    await includeProjectInSearch({ db, projectId: W.projectId as ProjectId });
    for (let step = 0; step < 30; step += 1) {
      const result = await runSearchBackfillStep({ db, now: W.now });
      if (result.isDone) {
        break;
      }
    }
    expect([...(await ids({ db, query: { text: 'lindqvist' } }))].sort()).toEqual([
      'message:late',
      'message:msg-user',
    ]);
  });

  it('reports the size and the doc count of the index', async () => {
    const db = await seeded();
    const status = await readSearchIndexStatus({ db });
    expect(status.docs).toBe(19);
    expect(status.bytes).toBeGreaterThan(0);
  });

  it('splits marked text into segments', () => {
    expect(parseMarkedText({ text: 'a b c' })).toEqual([
      { text: 'a ', isMatch: false },
      { text: 'b', isMatch: true },
      { text: ' c', isMatch: false },
    ]);
  });
});
