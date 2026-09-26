import { describe, expect, it } from 'vitest';
import type { IsoDateTime, ProjectId, SecurityFindingId, WorkspaceId } from '@goodboy/types';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import {
  countOpenSecurityFindings,
  dismissSecurityFinding,
  flagSecurityFindingAgain,
  listDismissedSecurityFindings,
  listOpenSecurityFindings,
  recordSecurityFindings,
} from './security-finding';

const workspaceId = 'workspace-1' as WorkspaceId;
const at = ({ value }: { readonly value: string }): IsoDateTime =>
  new Date(value).toISOString() as IsoDateTime;

const seed = async (): Promise<Database> => {
  const db = await makeMigratedTestDatabase();
  const now = Date.now();
  await db.execute(
    `INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, 'Harborline', 'harborline', ?, ?)`,
    [workspaceId, now, now],
  );
  return db;
};

describe('security finding queries', () => {
  it('records a new open finding and lists it', async () => {
    const db = await seed();

    await recordSecurityFindings({
      db,
      workspaceId,
      projectId: null,
      subjectKind: 'script',
      subjectId: 'script-1',
      findings: [{ secretKind: 'github-token', fingerprint: 'fp-1', last4: '3f9a' }],
      at: at({ value: '2026-09-25T09:00:00Z' }),
    });

    const open = await listOpenSecurityFindings({ db, workspaceId });
    expect(open).toHaveLength(1);
    expect(open[0]?.fingerprint).toBe('fp-1');
    expect(open[0]?.secretKind).toBe('github-token');
    expect(open[0]?.subjectKind).toBe('script');
    expect(await countOpenSecurityFindings({ db, workspaceId })).toBe(1);
  });

  it('resolves a finding once the secret disappears from the text, and reopens it if it comes back', async () => {
    const db = await seed();
    const first = at({ value: '2026-09-25T09:00:00Z' });
    const second = at({ value: '2026-09-25T09:05:00Z' });
    const third = at({ value: '2026-09-25T09:10:00Z' });

    await recordSecurityFindings({
      db,
      workspaceId,
      projectId: null,
      subjectKind: 'script',
      subjectId: 'script-1',
      findings: [{ secretKind: 'github-token', fingerprint: 'fp-1', last4: '3f9a' }],
      at: first,
    });
    await recordSecurityFindings({
      db,
      workspaceId,
      projectId: null,
      subjectKind: 'script',
      subjectId: 'script-1',
      findings: [],
      at: second,
    });
    expect(await listOpenSecurityFindings({ db, workspaceId })).toHaveLength(0);

    await recordSecurityFindings({
      db,
      workspaceId,
      projectId: null,
      subjectKind: 'script',
      subjectId: 'script-1',
      findings: [{ secretKind: 'github-token', fingerprint: 'fp-1', last4: '3f9a' }],
      at: third,
    });
    const reopened = await listOpenSecurityFindings({ db, workspaceId });
    expect(reopened).toHaveLength(1);
    expect(reopened[0]?.fingerprint).toBe('fp-1');
  });

  it('dismisses a finding out of the open list and into the dismissed group, then flags it again', async () => {
    const db = await seed();
    await recordSecurityFindings({
      db,
      workspaceId,
      projectId: null,
      subjectKind: 'permission-rule',
      subjectId: 'rule-1',
      findings: [{ secretKind: 'aws-access-key', fingerprint: 'fp-2', last4: 'aaaa' }],
      at: at({ value: '2026-09-25T09:00:00Z' }),
    });
    const [finding] = await listOpenSecurityFindings({ db, workspaceId });
    const findingId = finding?.id as SecurityFindingId;

    await dismissSecurityFinding({ db, findingId, at: at({ value: '2026-09-25T09:01:00Z' }) });
    expect(await listOpenSecurityFindings({ db, workspaceId })).toHaveLength(0);
    const dismissed = await listDismissedSecurityFindings({ db, workspaceId });
    expect(dismissed).toHaveLength(1);
    expect(dismissed[0]?.id).toBe(findingId);

    await flagSecurityFindingAgain({ db, findingId });
    expect(await listOpenSecurityFindings({ db, workspaceId })).toHaveLength(1);
    expect(await listDismissedSecurityFindings({ db, workspaceId })).toHaveLength(0);
  });

  it('never resurfaces a dismissed finding just because the same value is scanned again', async () => {
    const db = await seed();
    const seenAt = at({ value: '2026-09-25T09:00:00Z' });
    await recordSecurityFindings({
      db,
      workspaceId,
      projectId: null,
      subjectKind: 'script',
      subjectId: 'script-2',
      findings: [{ secretKind: 'openai-key', fingerprint: 'fp-3', last4: '1234' }],
      at: seenAt,
    });
    const [finding] = await listOpenSecurityFindings({ db, workspaceId });
    await dismissSecurityFinding({
      db,
      findingId: finding?.id as SecurityFindingId,
      at: seenAt,
    });

    await recordSecurityFindings({
      db,
      workspaceId,
      projectId: null,
      subjectKind: 'script',
      subjectId: 'script-2',
      findings: [{ secretKind: 'openai-key', fingerprint: 'fp-3', last4: '1234' }],
      at: at({ value: '2026-09-25T09:05:00Z' }),
    });

    expect(await listOpenSecurityFindings({ db, workspaceId })).toHaveLength(0);
    expect(await listDismissedSecurityFindings({ db, workspaceId })).toHaveLength(1);
  });

  it('carries the owning project when the subject belongs to one', async () => {
    const db = await seed();
    const projectId = 'project-1' as ProjectId;
    const now = Date.now();
    await db.execute(
      `INSERT INTO projects (id, workspace_id, name, root_path, kind, created_at, updated_at)
       VALUES (?, ?, 'ledger-core', '/repos/ledger-core', 'repo', ?, ?)`,
      [projectId, workspaceId, now, now],
    );

    await recordSecurityFindings({
      db,
      workspaceId,
      projectId,
      subjectKind: 'script',
      subjectId: 'script-3',
      findings: [{ secretKind: 'gitlab-token', fingerprint: 'fp-4', last4: 'bbbb' }],
      at: at({ value: '2026-09-25T09:00:00Z' }),
    });

    const [finding] = await listOpenSecurityFindings({ db, workspaceId });
    expect(finding?.projectId).toBe(projectId);
  });
});
