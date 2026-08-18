// @vitest-environment happy-dom

import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IsoDateTime, WorkspaceId } from '@goodboy/types';
import { ToastProvider } from '../../../../app/components/Toast';
import type { SlackThreadGroup, SlackThreadRow } from './useSlackThreads';

const h = vi.hoisted(() => ({
  integrations: {} as Record<string, ReadonlyArray<{ provider: string }>>,
  groups: [] as ReadonlyArray<SlackThreadGroup>,
  isEnabled: null as boolean | null,
  disconnectIntegration: vi.fn(async () => undefined),
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T,>(
    selector: (state: {
      workspaceIntegrations: typeof h.integrations;
      disconnectIntegration: typeof h.disconnectIntegration;
    }) => T,
  ) =>
    selector({
      workspaceIntegrations: h.integrations,
      disconnectIntegration: h.disconnectIntegration,
    }),
}));

vi.mock('../../../../shared/components/StudioShell', () => ({
  StudioShell: ({
    children,
    headerAccessory,
  }: {
    children: (requestClose: () => void) => ReactNode;
    headerAccessory: ReactNode;
  }) => (
    <div>
      {headerAccessory}
      {children(vi.fn())}
    </div>
  ),
}));

vi.mock('./useSlackThreads', () => ({
  useSlackThreads: (params: { isEnabled: boolean }) => {
    h.isEnabled = params.isEnabled;
    return {
      groups: h.groups,
      channels: [],
      users: [],
      hiddenChannelCount: 0,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    };
  },
}));

vi.mock('./ThreadDetailPanel', () => ({
  ThreadDetailPanel: ({ row }: { row: SlackThreadRow | null }) => (
    <div data-testid="detail">{row?.head.text ?? 'none'}</div>
  ),
}));

vi.mock('../SlackFormBody', () => ({
  SlackFormBody: () => (
    <label htmlFor="slack-token-test">
      Bot token
      <input id="slack-token-test" />
    </label>
  ),
}));

import { SlackStudio } from '.';

const row = (ts: string, text: string): SlackThreadRow => ({
  channel: { id: 'C1', name: 'eng-alerts', isMember: true, topic: null, memberCount: 3 },
  head: {
    ts,
    threadTs: ts,
    userId: 'U1',
    botId: null,
    text,
    subtype: null,
    replyCount: 2,
    replyUserCount: 2,
    postedAt: '2026-08-05T09:00:00Z' as IsoDateTime,
    latestReplyAt: '2026-08-05T09:00:00Z' as IsoDateTime,
    reactions: [],
  },
  sessionId: null,
});

const renderStudio = () =>
  render(
    <ToastProvider>
      <SlackStudio
        workspaceId={'workspace-1' as WorkspaceId}
        workspaceName="Goodboy"
        onClose={vi.fn()}
      />
    </ToastProvider>,
  );

beforeEach(() => {
  h.integrations = {};
  h.groups = [];
  h.isEnabled = null;
});
afterEach(() => {
  cleanup();
  h.disconnectIntegration.mockReset();
});

describe('SlackStudio', () => {
  it('asks for the connection before showing an inbox', () => {
    renderStudio();

    expect(screen.getByText('Connect Slack to read the threads a task came out of')).toBeDefined();
    expect(screen.getByLabelText('Bot token')).toBeDefined();
    expect(h.isEnabled).toBe(false);
    expect(screen.queryByRole('button', { name: 'Disconnect Slack' })).toBeNull();
  });

  it('lists thread heads and focuses the first one once connected', () => {
    h.integrations = { 'workspace-1': [{ provider: 'slack' }] };
    h.groups = [
      {
        key: 'C1',
        label: '#eng-alerts',
        rows: [row('1723456789.123456', 'billing webhook fails'), row('1723400000.000100', 'ping')],
      },
    ];

    renderStudio();

    expect(h.isEnabled).toBe(true);
    expect(screen.getByText('#eng-alerts')).toBeDefined();
    expect(screen.getAllByText('billing webhook fails')).toHaveLength(2);
    expect(screen.getByTestId('detail').textContent).toBe('billing webhook fails');
  });

  it('opens the thread the user clicks', () => {
    h.integrations = { 'workspace-1': [{ provider: 'slack' }] };
    h.groups = [
      {
        key: 'C1',
        label: '#eng-alerts',
        rows: [row('1723456789.123456', 'billing webhook fails'), row('1723400000.000100', 'ping')],
      },
    ];

    renderStudio();

    fireEvent.click(screen.getByText('ping'));

    expect(screen.getByTestId('detail').textContent).toBe('ping');
  });

  it('disconnects Slack from the header once connected', async () => {
    h.integrations = { 'workspace-1': [{ provider: 'slack' }] };

    renderStudio();

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect Slack' }));
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect Slack' }));

    await vi.waitFor(() =>
      expect(h.disconnectIntegration).toHaveBeenCalledWith({
        workspaceId: 'workspace-1',
        provider: 'slack',
      }),
    );
  });

  it('says nothing is there when the bot joined no channels', () => {
    h.integrations = { 'workspace-1': [{ provider: 'slack' }] };

    renderStudio();

    expect(screen.getByText('No channels yet')).toBeDefined();
    expect(
      screen.getByText(
        'Invite the bot to a public channel in Slack and it shows up here. Goodboy only sees channels the bot has joined.',
      ),
    ).toBeDefined();
  });
});
