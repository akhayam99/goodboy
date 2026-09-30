// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionId, WorkspaceId } from '@goodboy/types';

const { decideIntegrationDraft, listPendingSlackDrafts, listPendingSlackDraftsForSession } =
  vi.hoisted(() => ({
    decideIntegrationDraft: vi.fn(),
    listPendingSlackDrafts: vi.fn(),
    listPendingSlackDraftsForSession: vi.fn(),
  }));

vi.mock('@goodboy/db', async () =>
  (await import('../../../test/dbMock')).createDbMock({
    decideIntegrationDraft,
    listPendingSlackDrafts,
    listPendingSlackDraftsForSession,
  }),
);
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

import {
  decideSlackDraft,
  loadPendingSlackDrafts,
  loadPendingSlackDraftsForSession,
} from './drafts';

const workspaceId = 'w1' as WorkspaceId;

beforeEach(() => {
  decideIntegrationDraft.mockReset();
  listPendingSlackDrafts.mockReset();
  listPendingSlackDraftsForSession.mockReset();
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

describe('loadPendingSlackDraftsForSession', () => {
  it('scopes the lookup to the session', async () => {
    listPendingSlackDraftsForSession.mockResolvedValueOnce([]);
    const sessionId = 's1' as SessionId;

    await loadPendingSlackDraftsForSession(sessionId);

    expect(listPendingSlackDraftsForSession).toHaveBeenCalledWith({ db: {}, sessionId });
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
