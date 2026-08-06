// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IsoDateTime, SessionExternalTask, WorkspaceId } from '@goodboy/types';
import type { SlackMessage } from '../../../../../integrations/slack/client';

const h = vi.hoisted(() => ({
  messages: [] as ReadonlyArray<SlackMessage>,
  reply: vi.fn(async (_params: Record<string, unknown>) => undefined),
  react: vi.fn(async (_params: Record<string, unknown>) => undefined),
}));

vi.mock('../../../../../../store', () => {
  const state = {
    replyToSlackThread: (params: Record<string, unknown>) => h.reply(params),
    addSlackReaction: (params: Record<string, unknown>) => h.react(params),
  };
  return {
    EMPTY_ARRAY: Object.freeze([]),
    useAppStore: <T,>(selector: (value: typeof state) => T): T => selector(state),
  };
});

vi.mock('../../../../../integrations/slack/useSlackThread', () => ({
  useSlackThread: () => ({
    messages: h.messages,
    users: [{ id: 'U1', name: 'ada', isBot: false, isDeleted: false, avatarUrl: null }],
    channels: [],
    channelName: 'eng-alerts',
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

const { SlackTaskDetail } = await import('./SlackTaskDetail');

const message = (ts: string, text: string): SlackMessage => ({
  ts,
  threadTs: '1723456789.123456',
  userId: 'U1',
  botId: null,
  text,
  subtype: null,
  replyCount: 1,
  replyUserCount: 1,
  postedAt: '2026-08-05T09:00:00Z' as IsoDateTime,
  latestReplyAt: null,
  reactions: [],
});

const TASK = {
  provider: 'slack',
  externalId: 'C1:1723456789.123456',
  identifier: '#eng-alerts › billing webhook fails on retry',
  url: 'https://acme.slack.com/archives/C1/p1723456789123456',
  title: 'billing webhook fails on retry',
  createdAt: '2026-08-05T09:00:00Z' as IsoDateTime,
} as SessionExternalTask;

beforeEach(() => {
  h.messages = [message('1723456789.123456', 'billing webhook fails on retry')];
  h.reply.mockReset();
  h.reply.mockResolvedValue(undefined);
  h.react.mockReset();
  h.react.mockResolvedValue(undefined);
});
afterEach(cleanup);

describe('SlackTaskDetail', () => {
  it('replies from the session lens to the thread the task points at', async () => {
    render(<SlackTaskDetail workspaceId={'workspace-1' as WorkspaceId} task={TASK} />);

    expect(screen.getByText('Sent as plain text')).toBeDefined();
    fireEvent.change(screen.getByLabelText('Reply in thread'), { target: { value: 'on it' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reply' }));

    await waitFor(() => {
      expect(h.reply).toHaveBeenCalledWith({
        workspaceId: 'workspace-1',
        channelId: 'C1',
        threadTs: '1723456789.123456',
        text: 'on it',
      });
    });
  });

  it('offers no composer when the link no longer points at a thread', () => {
    render(
      <SlackTaskDetail
        workspaceId={'workspace-1' as WorkspaceId}
        task={{ ...TASK, externalId: 'not-a-thread' } as SessionExternalTask}
      />,
    );

    expect(screen.getByText('This link no longer points at a thread')).toBeDefined();
    expect(screen.queryByLabelText('Reply in thread')).toBeNull();
  });
});
