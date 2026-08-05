// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IsoDateTime, WorkspaceId } from '@goodboy/types';
import type { SlackMessage } from '../client';
import type { SlackThreadRow } from './useSlackThreads';

const h = vi.hoisted(() => ({
  messages: [] as ReadonlyArray<SlackMessage>,
  launch: null as Record<string, unknown> | null,
  reply: vi.fn(async (_params: Record<string, unknown>) => undefined),
  react: vi.fn(async (_params: Record<string, unknown>) => undefined),
}));

vi.mock('../client', () => ({
  slackGetPermalink: vi.fn(async () => 'https://acme.slack.com/archives/C1/p1723456789123456'),
}));

vi.mock('../../../../store', () => {
  const state = {
    replyToSlackThread: (params: Record<string, unknown>) => h.reply(params),
    addSlackReaction: (params: Record<string, unknown>) => h.react(params),
  };
  return {
    EMPTY_ARRAY: Object.freeze([]),
    useAppStore: <T,>(selector: (value: typeof state) => T): T => selector(state),
  };
});

vi.mock('../useSlackThread', () => ({
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

vi.mock('../../components/LaunchSessionPanel', () => ({
  LaunchSessionPanel: (props: Record<string, unknown>) => {
    h.launch = props;
    return <div data-testid="launch" />;
  },
}));

import { ThreadDetailPanel } from './ThreadDetailPanel';

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
  latestReplyAt: '2026-08-05T09:10:00Z' as IsoDateTime,
  reactions: [],
});

const ROW: SlackThreadRow = {
  channel: { id: 'C1', name: 'eng-alerts', isMember: true, topic: null, memberCount: 3 },
  head: message('1723456789.123456', 'billing webhook fails on retry'),
  sessionId: null,
};

beforeEach(() => {
  h.messages = [];
  h.launch = null;
  h.reply.mockReset();
  h.reply.mockResolvedValue(undefined);
  h.react.mockReset();
  h.react.mockResolvedValue(undefined);
});
afterEach(cleanup);

describe('ThreadDetailPanel', () => {
  it('asks for a thread before showing one', () => {
    render(
      <ThreadDetailPanel
        row={null}
        workspaceId={'workspace-1' as WorkspaceId}
        sessionId={null}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('No thread selected')).toBeDefined();
  });

  it('renders the thread messages and hands the launch panel a thread-scoped task', () => {
    h.messages = [
      message('1723456789.123456', 'billing webhook fails on retry'),
      message('1723456999.000100', 'i can *repro* it'),
    ];

    render(
      <ThreadDetailPanel
        row={ROW}
        workspaceId={'workspace-1' as WorkspaceId}
        sessionId={null}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('repro')).toBeDefined();
    expect(h.launch?.externalTask).toMatchObject({
      provider: 'slack',
      externalId: 'C1:1723456789.123456',
      identifier: '#eng-alerts › billing webhook fails on retry',
      title: 'billing webhook fails on retry',
    });
    expect(h.launch?.branchSlugSeed).toBe('billing-webhook-fails-on-retry');
    expect(String(h.launch?.goalSeed)).toContain('Slack thread in #eng-alerts');
    expect(String(h.launch?.goalSeed)).toContain('ada: billing webhook fails on retry');
  });

  it('posts a reply into the thread the panel is reading', async () => {
    h.messages = [
      message('1723456789.123456', 'billing webhook fails on retry'),
      message('1723456999.000100', 'i can repro it'),
    ];

    render(
      <ThreadDetailPanel
        row={ROW}
        workspaceId={'workspace-1' as WorkspaceId}
        sessionId={null}
        onClose={vi.fn()}
      />,
    );

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

  it('reacts to a reply the thread fetch returned, not to the head it fell back on', () => {
    h.messages = [
      message('1723456789.123456', 'billing webhook fails on retry'),
      message('1723456999.000100', 'i can repro it'),
    ];

    render(
      <ThreadDetailPanel
        row={ROW}
        workspaceId={'workspace-1' as WorkspaceId}
        sessionId={null}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'React with :eyes:' })[1]!);

    expect(h.react).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      channelId: 'C1',
      threadTs: '1723456789.123456',
      messageTs: '1723456999.000100',
      name: 'eyes',
    });
  });
});
