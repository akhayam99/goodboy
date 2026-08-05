// @vitest-environment happy-dom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IsoDateTime, WorkspaceId } from '@goodboy/types';
import type { SlackMessage } from '../client';
import type { SlackThreadRow } from './useSlackThreads';

const h = vi.hoisted(() => ({
  messages: [] as ReadonlyArray<SlackMessage>,
  launch: null as Record<string, unknown> | null,
}));

vi.mock('../client', () => ({
  slackGetPermalink: vi.fn(async () => 'https://acme.slack.com/archives/C1/p1723456789123456'),
}));

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
});
