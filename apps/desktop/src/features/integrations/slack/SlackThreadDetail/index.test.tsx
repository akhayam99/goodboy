// @vitest-environment happy-dom

import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IntegrationDraft, IntegrationDraftId, SessionId, WorkspaceId } from '@goodboy/types';

const h = vi.hoisted(() => ({
  reply: vi.fn(async (_text: string) => undefined),
  draft: null as IntegrationDraft | null,
  markSent: vi.fn(async (_body: string) => undefined),
  discard: vi.fn(),
}));

vi.mock('../../../../store', () => {
  const state = {
    slackThreads: {},
    slackUsers: {},
    slackChannels: {},
    workspaceIntegrations: {} as Record<string, ReadonlyArray<Record<string, unknown>>>,
    refreshSlackThread: vi.fn(async () => undefined),
    refreshSlackUsers: vi.fn(async () => undefined),
    refreshSlackChannels: vi.fn(async () => undefined),
    replyToSlackThread: vi.fn(async (params: { text: string }) => {
      await h.reply(params.text);
    }),
    addSlackReaction: vi.fn(async () => undefined),
  };
  const useAppStore = <T,>(selector: (value: typeof state) => T): T => selector(state);
  useAppStore.getState = () => state;
  return { EMPTY_ARRAY: Object.freeze([]), useAppStore };
});

vi.mock('../client', () => ({
  slackGetPermalink: vi.fn(async () => null),
}));

vi.mock('../useSlackDraft', () => ({
  useSlackDraft: () => ({ draft: h.draft, markSent: h.markSent, discard: h.discard }),
}));

vi.mock('../../../../shared/components/Conversation/useConversationPane', () => ({
  useConversationPane: () => ({
    composer: null,
    section: {
      key: 'conversation',
      kind: 'conversation',
      label: 'Conversation',
      isCollapsible: false,
      defaultOpen: true,
      content: null,
    },
  }),
}));

const { SlackThreadDetail } = await import('./index');

const WORKSPACE_ID = 'ws-1' as WorkspaceId;

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
  h.draft = null;
  h.reply.mockClear();
  h.markSent.mockClear();
  h.discard.mockClear();
});

afterEach(cleanup);

describe('SlackThreadDetail draft banner', () => {
  it('shows nothing when there is no pending draft', () => {
    render(
      <SlackThreadDetail
        workspaceId={WORKSPACE_ID}
        channelId="C1"
        threadTs="111.1"
        fallbackChannelName="payments"
        fallbackMessage={null}
      />,
    );

    expect(screen.queryByText('Drafted by an agent')).toBeNull();
  });

  it('shows the draft body with Send and Discard', () => {
    h.draft = draft;
    render(
      <SlackThreadDetail
        workspaceId={WORKSPACE_ID}
        channelId="C1"
        threadTs="111.1"
        fallbackChannelName="payments"
        fallbackMessage={null}
      />,
    );

    expect(screen.getByText('Drafted by an agent')).toBeDefined();
    expect(screen.getByText('Looking into it now.')).toBeDefined();
  });

  it('sends the draft body and marks it sent', async () => {
    h.draft = draft;
    render(
      <SlackThreadDetail
        workspaceId={WORKSPACE_ID}
        channelId="C1"
        threadTs="111.1"
        fallbackChannelName="payments"
        fallbackMessage={null}
      />,
    );

    await act(async () => {
      screen.getByRole('button', { name: 'Send' }).click();
    });

    await waitFor(() => expect(h.reply).toHaveBeenCalledWith('Looking into it now.'));
    expect(h.markSent).toHaveBeenCalledWith('Looking into it now.');
  });

  it('discards the draft without posting', () => {
    h.draft = draft;
    render(
      <SlackThreadDetail
        workspaceId={WORKSPACE_ID}
        channelId="C1"
        threadTs="111.1"
        fallbackChannelName="payments"
        fallbackMessage={null}
      />,
    );

    act(() => {
      screen.getByRole('button', { name: 'Discard' }).click();
    });

    expect(h.discard).toHaveBeenCalledTimes(1);
    expect(h.reply).not.toHaveBeenCalled();
  });
});
