import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceId } from '@goodboy/types';

const { decideIntegrationDraft, listPendingSlackDrafts } = vi.hoisted(() => ({
  decideIntegrationDraft: vi.fn(),
  listPendingSlackDrafts: vi.fn(),
}));

vi.mock('@goodboy/db', () => ({ decideIntegrationDraft, listPendingSlackDrafts }));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

import { decideSlackDraft, loadPendingSlackDrafts } from './drafts';

const workspaceId = 'w1' as WorkspaceId;

beforeEach(() => {
  decideIntegrationDraft.mockReset();
  listPendingSlackDrafts.mockReset();
});

describe('loadPendingSlackDrafts', () => {
  it('scopes the lookup to the workspace, channel and thread', async () => {
    listPendingSlackDrafts.mockResolvedValueOnce([]);

    await loadPendingSlackDrafts({ workspaceId, channelId: 'C1', threadTs: '111.1' });

    expect(listPendingSlackDrafts).toHaveBeenCalledWith({
      db: {},
      workspaceId,
      channelId: 'C1',
      threadTs: '111.1',
    });
  });
});

describe('decideSlackDraft', () => {
  it('passes the body through when editing before send', async () => {
    decideIntegrationDraft.mockResolvedValueOnce(true);

    const ok = await decideSlackDraft({ id: 'd1', status: 'sent', body: 'edited text' });

    expect(ok).toBe(true);
    expect(decideIntegrationDraft).toHaveBeenCalledWith({
      db: {},
      id: 'd1',
      status: 'sent',
      body: 'edited text',
    });
  });

  it('omits the body when discarding without an edit', async () => {
    decideIntegrationDraft.mockResolvedValueOnce(true);

    await decideSlackDraft({ id: 'd1', status: 'discarded' });

    expect(decideIntegrationDraft).toHaveBeenCalledWith({ db: {}, id: 'd1', status: 'discarded' });
  });
});
