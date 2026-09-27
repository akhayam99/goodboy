import { describe, expect, it } from 'vitest';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { m202SlackBindingSettings } from './m202-slack-binding-settings';

describe('m202 slack binding settings', () => {
  it('renames the Slack identity and adds safe agent defaults', async () => {
    const db = await makeMigratedTestDatabase({ throughVersion: 190 });
    await db.execute(
      "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Harborline', 'harborline', 1, 1)",
    );
    await db.execute(
      `INSERT INTO integration_credentials (id, provider, label, account, created_at, updated_at)
       VALUES ('credential', 'slack', 'Mara', 'Harborline', 1, 1)`,
    );
    await db.execute(
      `INSERT INTO integration_bindings
        (id, workspace_id, project_id, provider, config, credential_id, created_at, updated_at)
       VALUES
        ('binding', 'workspace', NULL, 'slack', '{"teamId":"T1","teamName":"Harborline","botUserId":"U1","botUserName":"Mara"}', 'credential', 1, 1)`,
    );

    await db.exec(m202SlackBindingSettings);

    const rows = await db.select<{ readonly config: string }>(
      "SELECT config FROM integration_bindings WHERE id = 'binding'",
    );
    expect(JSON.parse(rows[0]?.config ?? '')).toEqual({
      teamId: 'T1',
      teamName: 'Harborline',
      userId: 'U1',
      userName: 'Mara',
      followedChannels: [],
      hasSelectedChannels: true,
      includePrivate: false,
      agentPolicy: {
        readFollowed: 'allow',
        readOthers: 'off',
        reply: 'ask',
        react: 'allow',
      },
      signature: { agents: true, own: false, text: 'Written with Goodboy' },
    });
  });
});
