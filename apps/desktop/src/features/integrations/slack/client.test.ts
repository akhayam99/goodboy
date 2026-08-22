import { afterEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import type { IntegrationCredentialId, WorkspaceId } from '@goodboy/types';
import {
  slackAddReaction,
  slackConnect,
  slackGetPermalink,
  slackGetThread,
  slackListChannels,
  slackListThreadHeads,
  slackListUsers,
  slackPostReply,
  slackValidateConnection,
} from './client';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

const mockInvoke = vi.mocked(invoke);

afterEach(() => {
  mockInvoke.mockReset();
});

const workspaceId = 'w1' as WorkspaceId;
const credentialId = 'cred-1' as IntegrationCredentialId;
const channelId = 'C0EN';
const threadTs = '1723456789.123456';

describe('slack client', () => {
  it('probes a token under a credential id, never under a goodboy workspace', async () => {
    mockInvoke.mockResolvedValue({ teamId: 'T01' });

    await slackValidateConnection({ credentialId, botToken: 'xoxp-secret' });

    expect(mockInvoke).toHaveBeenCalledWith('slack_validate_connection', {
      credentialId,
      botToken: 'xoxp-secret',
    });
    expect(mockInvoke).not.toHaveBeenCalledWith(
      'slack_validate_connection',
      expect.objectContaining({ workspaceId: expect.anything() }),
    );
  });

  it('reuses a stored credential by naming it alone, with no token in the payload', async () => {
    await slackConnect({ credentialId, botToken: null });

    expect(mockInvoke).toHaveBeenCalledWith('slack_connect', {
      credentialId,
      botToken: null,
    });
  });

  it('reads channels and users with the workspace id alone', async () => {
    mockInvoke.mockResolvedValue([]);

    await slackListChannels({ workspaceId });
    expect(mockInvoke).toHaveBeenCalledWith('slack_list_channels', { workspaceId });

    await slackListUsers({ workspaceId });
    expect(mockInvoke).toHaveBeenCalledWith('slack_list_users', { workspaceId });
  });

  it('separates the thread head list from the thread read', async () => {
    mockInvoke.mockResolvedValue([]);

    await slackListThreadHeads({ workspaceId, channelId });
    expect(mockInvoke).toHaveBeenCalledWith('slack_list_thread_heads', { workspaceId, channelId });

    await slackGetThread({ workspaceId, channelId, threadTs });
    expect(mockInvoke).toHaveBeenCalledWith('slack_get_thread', {
      workspaceId,
      channelId,
      threadTs,
    });
  });

  it('asks for a permalink by message timestamp, not by thread timestamp', async () => {
    mockInvoke.mockResolvedValue('https://acme.slack.com/archives/C0EN/p1723456789123456');

    await slackGetPermalink({ workspaceId, channelId, messageTs: threadTs });

    expect(mockInvoke).toHaveBeenCalledWith('slack_get_permalink', {
      workspaceId,
      channelId,
      messageTs: threadTs,
    });
  });

  it('posts a reply into the thread and a reaction onto a message', async () => {
    mockInvoke.mockResolvedValue({ ts: '1723460000.000200' });

    await slackPostReply({ workspaceId, channelId, threadTs, text: 'on it' });
    expect(mockInvoke).toHaveBeenCalledWith('slack_post_reply', {
      workspaceId,
      channelId,
      threadTs,
      text: 'on it',
    });

    await slackAddReaction({ workspaceId, channelId, messageTs: threadTs, name: 'eyes' });
    expect(mockInvoke).toHaveBeenCalledWith('slack_add_reaction', {
      workspaceId,
      channelId,
      messageTs: threadTs,
      name: 'eyes',
    });
  });
});
