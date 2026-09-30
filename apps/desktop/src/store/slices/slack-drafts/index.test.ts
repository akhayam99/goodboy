// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IntegrationDraft, IntegrationDraftId, SessionId, WorkspaceId } from '@goodboy/types';

const { loadPendingSlackDraftsForSession, decideSlackDraft } = vi.hoisted(() => ({
  loadPendingSlackDraftsForSession: vi.fn(),
  decideSlackDraft: vi.fn(),
}));

vi.mock('../../../features/integrations/slack/drafts', () => ({
  loadPendingSlackDraftsForSession,
  decideSlackDraft,
}));

import { decideSessionSlackDraft } from './decideSessionSlackDraft';
import { loadSessionSlackDrafts } from './loadSessionSlackDrafts';
import type { AppStore } from '../../store';
import type { SetFn } from './types';

const sessionId = 'sess-1' as SessionId;
const otherSessionId = 'sess-2' as SessionId;

const draft = (id: string): IntegrationDraft => ({
  id: id as IntegrationDraftId,
  workspaceId: 'ws-1' as WorkspaceId,
  sessionId,
  provider: 'slack',
  verb: 'reply',
  target: { channelId: 'C1', threadTs: '1' },
  body: 'ready to send',
  status: 'pending',
  createdAt: '2026-09-26T00:00:00.000Z',
  updatedAt: '2026-09-26T00:00:00.000Z',
  decidedAt: null,
});

const makeSet = () => {
  let state = { sessionSlackDrafts: {} } as unknown as AppStore;
  const set: SetFn = (patch) => {
    const next = typeof patch === 'function' ? patch(state) : patch;
    state = { ...state, ...next };
  };
  return { set, read: () => state };
};

beforeEach(() => {
  loadPendingSlackDraftsForSession.mockReset();
  decideSlackDraft.mockReset();
});

describe('loadSessionSlackDrafts', () => {
  it('stores the pending drafts for the session', async () => {
    const first = draft('d1');
    loadPendingSlackDraftsForSession.mockResolvedValueOnce([first]);
    const { set, read } = makeSet();

    await loadSessionSlackDrafts(set)(sessionId);

    expect(read().sessionSlackDrafts[sessionId]).toEqual([first]);
  });

  it('leaves the session untouched when the load fails', async () => {
    loadPendingSlackDraftsForSession.mockRejectedValueOnce(new Error('database is locked'));
    const { set, read } = makeSet();

    await expect(loadSessionSlackDrafts(set)(sessionId)).resolves.toBeUndefined();

    expect(read().sessionSlackDrafts[sessionId]).toBeUndefined();
  });
});

describe('decideSessionSlackDraft', () => {
  it('sends the id and body through to the query layer, then drops it from the list', async () => {
    const first = draft('d1');
    const second = draft('d2');
    decideSlackDraft.mockResolvedValueOnce(true);
    const { set, read } = makeSet();
    set({ sessionSlackDrafts: { [sessionId]: [first, second] } });

    await decideSessionSlackDraft(set)({
      sessionId,
      draftId: first.id,
      status: 'sent',
      body: 'edited text',
    });

    expect(decideSlackDraft).toHaveBeenCalledWith({
      id: first.id,
      status: 'sent',
      body: 'edited text',
    });
    expect(read().sessionSlackDrafts[sessionId]).toEqual([second]);
  });

  it('omits the body when discarding, and leaves other sessions alone', async () => {
    const first = draft('d1');
    decideSlackDraft.mockResolvedValueOnce(true);
    const { set, read } = makeSet();
    set({
      sessionSlackDrafts: {
        [sessionId]: [first],
        [otherSessionId]: [draft('d3')],
      },
    });

    await decideSessionSlackDraft(set)({ sessionId, draftId: first.id, status: 'discarded' });

    expect(decideSlackDraft).toHaveBeenCalledWith({ id: first.id, status: 'discarded' });
    expect(read().sessionSlackDrafts[sessionId]).toEqual([]);
    expect(read().sessionSlackDrafts[otherSessionId]).toHaveLength(1);
  });
});
