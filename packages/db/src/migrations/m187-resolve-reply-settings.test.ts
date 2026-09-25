import { describe, expect, it } from 'vitest';
import type { WorkspaceId } from '@goodboy/types';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { getWorkspaceOverrides, setWorkspaceOverrides } from '../queries/settings-overrides';
import { migrations } from './index';
import { migrate } from './runner';

const WORKSPACE = 'workspace' as WorkspaceId;

const seed = async () => {
  const db = await makeMigratedTestDatabase({ throughVersion: 186 });
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at, attribution_footer) VALUES ('workspace', 'Harborline', 'harborline', 1, 1, 0)",
  );
  return db;
};

describe('m187 resolve reply settings', () => {
  it('leaves workspaces made before it on the defaults', async () => {
    const db = await seed();

    await migrate(db, migrations);

    expect(await getWorkspaceOverrides(db, WORKSPACE)).toMatchObject({
      attributionFooter: false,
      replyVoice: null,
      replyStyleNote: null,
      replyTemplateFixed: null,
      replyTemplateNoChange: null,
      resolveOnGithub: null,
      resolveCommitStyle: null,
    });
  });

  it('keeps what a workspace chose when a crash makes it run a second time', async () => {
    const db = await seed();
    await migrate(db, migrations);
    const before = await getWorkspaceOverrides(db, WORKSPACE);
    if (before === null) {
      throw new Error('workspace missing');
    }
    await setWorkspaceOverrides(db, WORKSPACE, {
      ...before,
      replyVoice: 'mine',
      replyStyleNote: 'Short. Starts lowercase.',
      replyTemplateFixed: '{reason}\n\nDone in {commit}.',
      resolveOnGithub: false,
      resolveCommitStyle: 'fixup',
    });
    await db.execute('DELETE FROM schema_version WHERE version = 187');

    await migrate(db, migrations);

    expect(await getWorkspaceOverrides(db, WORKSPACE)).toMatchObject({
      replyVoice: 'mine',
      replyStyleNote: 'Short. Starts lowercase.',
      replyTemplateFixed: '{reason}\n\nDone in {commit}.',
      replyTemplateNoChange: null,
      resolveOnGithub: false,
      resolveCommitStyle: 'fixup',
    });
  });

  it('rejects a voice or a commit style it does not know', async () => {
    const db = await seed();
    await migrate(db, migrations);

    await expect(
      db.execute("UPDATE workspaces SET reply_voice = 'pirate' WHERE id = 'workspace'"),
    ).rejects.toThrow(/CHECK constraint failed/);
    await expect(
      db.execute("UPDATE workspaces SET resolve_commit_style = 'squash' WHERE id = 'workspace'"),
    ).rejects.toThrow(/CHECK constraint failed/);
  });
});
