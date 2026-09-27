// @vitest-environment happy-dom

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IntegrationDraft, IntegrationDraftId, SessionId, WorkspaceId } from '@goodboy/types';

const { decideSlackDraft, loadPendingSlackDrafts } = vi.hoisted(() => ({
  decideSlackDraft: vi.fn(),
  loadPendingSlackDrafts: vi.fn(),
}));

vi.mock('../drafts', () => ({ decideSlackDraft, loadPendingSlackDrafts }));

const { useSlackDraft } = await import('./index');

const WORKSPACE_ID = 'ws-1' as WorkspaceId;
const PARAMS = { workspaceId: WORKSPACE_ID, channelId: 'C1', threadTs: '111.1' };

const draft: IntegrationDraft = {
  id: 'd1' as IntegrationDraftId,
  workspaceId: WORKSPACE_ID,
  sessionId: 's1' as SessionId,
  provider: 'slack',
  verb: 'reply',
  target: { channelId: 'C1', threadTs: '111.1' },
  body: 'Looking into it now.',
  status: 'pending',
  createdAt: '2026-09-26T00:00:00.000Z',
  updatedAt: '2026-09-26T00:00:00.000Z',
  decidedAt: null,
};

beforeEach(() => {
  decideSlackDraft.mockReset();
  loadPendingSlackDrafts.mockReset();
});

describe('useSlackDraft', () => {
  it('loads the first pending draft for the thread', async () => {
    loadPendingSlackDrafts.mockResolvedValueOnce([draft]);

    const { result } = renderHook(() => useSlackDraft(PARAMS));

    await waitFor(() => expect(result.current.draft).toEqual(draft));
    expect(loadPendingSlackDrafts).toHaveBeenCalledWith(PARAMS);
  });

  it('marks the draft sent and clears it', async () => {
    loadPendingSlackDrafts.mockResolvedValueOnce([draft]);
    decideSlackDraft.mockResolvedValueOnce(true);

    const { result } = renderHook(() => useSlackDraft(PARAMS));
    await waitFor(() => expect(result.current.draft).toEqual(draft));

    await act(async () => {
      await result.current.markSent('edited text');
    });

    expect(decideSlackDraft).toHaveBeenCalledWith({
      id: 'd1',
      status: 'sent',
      body: 'edited text',
    });
    expect(result.current.draft).toBeNull();
  });

  it('discards the draft and clears it', async () => {
    loadPendingSlackDrafts.mockResolvedValueOnce([draft]);
    decideSlackDraft.mockResolvedValueOnce(true);

    const { result } = renderHook(() => useSlackDraft(PARAMS));
    await waitFor(() => expect(result.current.draft).toEqual(draft));

    act(() => {
      result.current.discard();
    });

    await waitFor(() => expect(result.current.draft).toBeNull());
    expect(decideSlackDraft).toHaveBeenCalledWith({ id: 'd1', status: 'discarded' });
  });
});
